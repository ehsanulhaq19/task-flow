import csv
import io
import re
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.markdown import normalize_markdown
from app.core.security import hash_password
from app.modules.admin.schemas import (
    AdminScreenshotResponse,
    AdminSummary,
    AdminTaskCreate,
    AdminTaskResponse,
    AdminTaskUpdate,
    AdminTimeEntryResponse,
    AdminTimeLogPage,
    AdminTimeLogPoint,
    AdminTimeLogSeries,
    OrganizationCreate,
    TaskImportError,
    TaskImportResult,
    UserCreate,
    UserLimitsUpdate,
)
from app.modules.auth.crud import get_user_by_email, get_user_by_id
from app.modules.auth.models import User
from app.modules.organization.models import Organization
from app.modules.screenshot.models import Screenshot
from app.modules.screenshot.service import resolve_stored_file
from app.modules.task.crud import list_task_keys
from app.modules.task.models import Task, TaskComment
from app.modules.task.service import comment_counts, next_task_key
from app.modules.cron.daily_report import overlap_seconds, report_zone
from app.modules.time_entry.models import TimeEntry

RANGES = ("daily", "weekly", "monthly")


def slugify(value: str) -> str:
    """Turn a name into a URL-safe slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:100]


async def summary(db: AsyncSession) -> AdminSummary:
    """Count the records the overview cards display."""

    async def count(model, *filters) -> int:
        query = select(func.count()).select_from(model)
        if filters:
            query = query.where(*filters)
        return int(await db.scalar(query) or 0)

    return AdminSummary(
        organizations=await count(Organization),
        users=await count(User),
        employees=await count(User, User.role == "employee"),
        tasks=await count(Task),
        open_timers=await count(TimeEntry, TimeEntry.ended_at.is_(None)),
        screenshots=await count(Screenshot),
    )


async def list_organizations(db: AsyncSession) -> list[Organization]:
    """Return every organization, alphabetical."""
    result = await db.execute(select(Organization).order_by(Organization.name))
    return list(result.scalars().all())


async def create_organization(db: AsyncSession, payload: OrganizationCreate) -> Organization:
    """Create an organization, generating a unique slug when one is not provided."""
    requested = slugify(payload.slug or payload.name)
    if not requested:
        raise BadRequestException("Choose a name that can become a slug")

    if payload.slug:
        taken = await db.scalar(select(Organization.id).where(Organization.slug == requested))
        if taken is not None:
            raise ConflictException("That organization slug is already in use")
        slug = requested
    else:
        slug = requested
        suffix = 2
        while await db.scalar(select(Organization.id).where(Organization.slug == slug)):
            slug = f"{requested[:90]}-{suffix}"
            suffix += 1
            if suffix > 50:
                raise ConflictException("Could not create a unique slug")

    organization = Organization(name=payload.name, slug=slug)
    db.add(organization)
    await db.flush()
    await db.refresh(organization)
    return organization


async def require_organization(db: AsyncSession, organization_id: uuid.UUID) -> Organization:
    """Return an organization or raise 404."""
    organization = await db.get(Organization, organization_id)
    if organization is None:
        raise NotFoundException("Organization not found")
    return organization


async def list_users(db: AsyncSession, organization_id: uuid.UUID | None) -> list[User]:
    """Return users, optionally limited to one organization."""
    query = select(User).order_by(User.first_name, User.last_name)
    if organization_id is not None:
        query = query.where(User.organization_id == organization_id)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_user(db: AsyncSession, payload: UserCreate) -> User:
    """Create a user and attach them to an organization."""
    organization = await require_organization(db, payload.organization_id)
    email = str(payload.email).lower()
    if await get_user_by_email(db, email):
        raise ConflictException("That email is already in use")
    if not payload.first_name or not payload.last_name:
        raise BadRequestException("First and last name are required")

    user = User(
        organization_id=organization.id,
        email=email,
        hashed_password=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=payload.role,
        job_title=payload.job_title or "Team member",
        daily_target_hours=8,
        configuration_data=(
            {"minimumHours": 8, "maximumHours": 10} if payload.role == "employee" else {}
        ),
    )
    user.organization = organization
    db.add(user)
    await db.flush()
    return user


def user_day_limits(person: User) -> tuple[float, float]:
    """Return an employee's daily minimum and maximum hours."""
    data = person.configuration_data or {}
    try:
        minimum = float(data.get("minimumHours", person.daily_target_hours or 8))
    except (TypeError, ValueError):
        minimum = float(person.daily_target_hours or 8)
    try:
        maximum = float(data.get("maximumHours", minimum))
    except (TypeError, ValueError):
        maximum = minimum
    if maximum < minimum:
        maximum = minimum
    return minimum, maximum


async def update_user_limits(db: AsyncSession, user_id: uuid.UUID, payload: UserLimitsUpdate) -> User:
    """Set the daily minimum and maximum for an employee."""
    user = await db.get(User, user_id)
    if user is None:
        raise NotFoundException("User not found")
    if user.role != "employee":
        raise BadRequestException("Daily limits can only be set for employees")
    user.configuration_data = {
        "minimumHours": payload.minimum_hours,
        "maximumHours": payload.maximum_hours,
    }
    user.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return user


async def list_tasks(db: AsyncSession, organization_id: uuid.UUID | None) -> list[AdminTaskResponse]:
    """Return tasks with their organization name."""
    query = (
        select(Task, Organization.name)
        .join(Organization, Task.organization_id == Organization.id)
        .order_by(Task.updated_at.desc())
    )
    if organization_id is not None:
        query = query.where(Task.organization_id == organization_id)
    rows = (await db.execute(query)).all()
    counts = await comment_counts(db, [task.id for task, _ in rows])
    return [_task_response(task, organization_name, counts.get(task.id, 0)) for task, organization_name in rows]


async def create_task(db: AsyncSession, payload: AdminTaskCreate) -> AdminTaskResponse:
    """Create a task in an organization and assign it to one of that organization's users."""
    organization = await require_organization(db, payload.organization_id)
    assignee = await get_user_by_id(db, payload.assignee_user_id)
    if assignee is None or assignee.organization_id != organization.id:
        raise BadRequestException("Choose a person from this organization")

    task = Task(
        organization_id=organization.id,
        key=next_task_key(await list_task_keys(db, organization.id)),
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        assignee=f"{assignee.first_name} {assignee.last_name}".strip(),
        assignee_user_id=assignee.id,
        labels=payload.labels,
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return _task_response(task, organization.name, 0)


def _task_response(task: Task, organization_name: str, comment_count: int) -> AdminTaskResponse:
    """Build the admin task payload, including its comment count."""
    return AdminTaskResponse(
        id=task.id,
        key=task.key,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        assignee=task.assignee,
        assignee_user_id=task.assignee_user_id,
        organization_id=task.organization_id,
        organization_name=organization_name,
        comment_count=comment_count,
        labels=list(task.labels or []),
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


_CSV_COLUMNS = {
    "task name": "name",
    "name": "name",
    "title": "name",
    "description": "description",
    "assignee email": "email",
    "email": "email",
    "priority": "priority",
}
_CSV_LABELS = {
    "name": "task name",
    "description": "description",
    "email": "assignee email",
    "priority": "priority",
}
_PRIORITIES = {"low", "medium", "high", "urgent"}
_MAX_CSV_BYTES = 1_048_576
_MAX_CSV_ROWS = 500


def _csv_header_key(cell: str) -> str:
    """Map a CSV heading to a task field, or return an empty string."""
    text = " ".join(cell.strip().lower().replace("_", " ").replace("-", " ").split())
    return _CSV_COLUMNS.get(text, "")


def _decode_csv(content: bytes, filename: str) -> str:
    """Return CSV text, or reject a file that is not a small UTF-8 spreadsheet."""
    if filename and not filename.lower().endswith(".csv"):
        raise BadRequestException("Upload a .csv file")
    if len(content) > _MAX_CSV_BYTES:
        raise BadRequestException("CSV file must be 1 MB or smaller")
    if not content.strip():
        raise BadRequestException("The CSV file is empty")
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            return content.decode("cp1252")
        except UnicodeDecodeError as exc:
            raise BadRequestException("Save the CSV as UTF-8") from exc


def _parse_task_csv(text: str) -> list[tuple[int, dict[str, str]]]:
    """Read task rows from CSV text. Row numbers match a spreadsheet, starting at 2."""
    if text.lower().startswith("sep="):
        text = text.split("\n", 1)[1] if "\n" in text else ""
    reader = csv.reader(io.StringIO(text))
    try:
        header = next(reader)
    except StopIteration as exc:
        raise BadRequestException("The CSV file is empty") from exc

    indexes: dict[str, int] = {}
    for index, cell in enumerate(header):
        key = _csv_header_key(cell)
        if not key:
            continue
        if key in indexes:
            raise BadRequestException(f"The CSV has more than one {_CSV_LABELS[key]} column")
        indexes[key] = index

    missing = [_CSV_LABELS[key] for key in ("name", "description", "email", "priority") if key not in indexes]
    if missing:
        raise BadRequestException("CSV must include task name, description, assignee email, and priority")

    rows: list[tuple[int, dict[str, str]]] = []
    for row_number, cells in enumerate(reader, start=2):
        fields = {key: (cells[index].strip() if index < len(cells) else "") for key, index in indexes.items()}
        if not any(fields.values()):
            continue
        rows.append((row_number, fields))
        if len(rows) > _MAX_CSV_ROWS:
            raise BadRequestException(f"CSV can include at most {_MAX_CSV_ROWS} tasks")
    if not rows:
        raise BadRequestException("The CSV file has no tasks")
    return rows


async def import_tasks_csv(
    db: AsyncSession,
    content: bytes,
    filename: str,
    organization_id: uuid.UUID | None,
) -> TaskImportResult:
    """Create Backlog tasks from a CSV. Valid rows are saved and invalid rows are reported."""
    selected = await require_organization(db, organization_id) if organization_id is not None else None
    parsed = _parse_task_csv(_decode_csv(content, filename))
    emails = {fields["email"].lower() for _, fields in parsed if fields["email"]}
    people: dict[str, User] = {}
    if emails:
        found = await db.execute(select(User).where(func.lower(User.email).in_(emails)))
        people = {user.email.lower(): user for user in found.scalars().all()}

    org_ids = {user.organization_id for user in people.values()}
    if selected is not None:
        org_ids.add(selected.id)
    organizations: dict[uuid.UUID, Organization] = {}
    if org_ids:
        org_rows = await db.execute(select(Organization).where(Organization.id.in_(org_ids)))
        organizations = {org.id: org for org in org_rows.scalars().all()}

    ready: list[tuple[User, str, str, str]] = []
    errors: list[TaskImportError] = []
    for row_number, fields in parsed:
        problem = _import_row_problem(fields, people, selected)
        if problem:
            errors.append(TaskImportError(row=row_number, message=problem))
            continue
        assignee = people[fields["email"].lower()]
        ready.append(
            (assignee, fields["name"].strip(), fields["description"].strip(), fields["priority"].strip().lower())
        )

    keys_by_org: dict[uuid.UUID, list[str]] = {}
    created: list[AdminTaskResponse] = []
    for assignee, title, description, priority in ready:
        organization = organizations[assignee.organization_id]
        if assignee.organization_id not in keys_by_org:
            keys_by_org[assignee.organization_id] = await list_task_keys(db, assignee.organization_id)
        key = next_task_key(keys_by_org[assignee.organization_id])
        keys_by_org[assignee.organization_id].append(key)
        task = Task(
            organization_id=organization.id,
            key=key,
            title=title,
            description=normalize_markdown(description),
            status="backlog",
            priority=priority,
            assignee=f"{assignee.first_name} {assignee.last_name}".strip(),
            assignee_user_id=assignee.id,
            labels=[],
        )
        db.add(task)
        await db.flush()
        await db.refresh(task)
        created.append(_task_response(task, organization.name, 0))
    return TaskImportResult(created=created, errors=errors)


def _import_row_problem(
    fields: dict[str, str],
    people: dict[str, User],
    selected: Organization | None,
) -> str:
    """Return why a CSV row cannot be imported, or an empty string when it is valid."""
    title = fields["name"].strip()
    if not title:
        return "Task name is required"
    if len(title) > 200:
        return "Task name must be 200 characters or fewer"
    if len(fields["description"].strip()) > 5000:
        return "Description must be 5000 characters or fewer"
    email = fields["email"].strip().lower()
    if not email:
        return "Assignee email is required"
    assignee = people.get(email)
    if assignee is None:
        return "No user with that email"
    if selected is not None and assignee.organization_id != selected.id:
        return "That email belongs to another organization"
    priority = fields["priority"].strip().lower()
    if priority not in _PRIORITIES:
        return "Priority must be low, medium, high, or urgent"
    return ""


async def require_task(db: AsyncSession, task_id: uuid.UUID) -> tuple[Task, Organization]:
    """Return a task and its organization, or raise 404."""
    task = await db.get(Task, task_id)
    if task is None:
        raise NotFoundException("Task not found")
    organization = await require_organization(db, task.organization_id)
    return task, organization


async def update_task(db: AsyncSession, task_id: uuid.UUID, payload: AdminTaskUpdate) -> AdminTaskResponse:
    """Replace the editable fields of a task. The key and organization stay the same."""
    task, organization = await require_task(db, task_id)
    assignee = await get_user_by_id(db, payload.assignee_user_id)
    if assignee is None or assignee.organization_id != organization.id:
        raise BadRequestException("Choose a person from this organization")
    task.title = payload.title
    task.description = payload.description
    task.status = payload.status
    task.priority = payload.priority
    task.assignee = f"{assignee.first_name} {assignee.last_name}".strip()
    task.assignee_user_id = assignee.id
    task.labels = payload.labels
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(task)
    counts = await comment_counts(db, [task.id])
    return _task_response(task, organization.name, counts.get(task.id, 0))


async def delete_task(db: AsyncSession, task_id: uuid.UUID) -> None:
    """Delete a task. Linked time entries keep their history with no task."""
    task, _organization = await require_task(db, task_id)
    await db.delete(task)
    await db.flush()


async def delete_tasks(db: AsyncSession, task_ids: list[uuid.UUID]) -> int:
    """Delete every task in the list that still exists."""
    unique_ids = list(dict.fromkeys(task_ids))
    found = await db.execute(select(Task).where(Task.id.in_(unique_ids)))
    tasks = list(found.scalars().all())
    for task in tasks:
        await db.delete(task)
    await db.flush()
    return len(tasks)


async def list_task_comments(db: AsyncSession, task_id: uuid.UUID) -> list[TaskComment]:
    """Return comments on a task, oldest first."""
    await require_task(db, task_id)
    result = await db.execute(
        select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at.asc())
    )
    return list(result.scalars().all())


async def add_task_comment(db: AsyncSession, admin: User, task_id: uuid.UUID, body: str) -> TaskComment:
    """Store a Markdown comment on a task."""
    await require_task(db, task_id)
    comment = TaskComment(
        task_id=task_id,
        user_id=admin.id,
        author_name=f"{admin.first_name} {admin.last_name}".strip(),
        body=body,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return comment


async def move_task(db: AsyncSession, task_id: uuid.UUID, status: str) -> AdminTaskResponse:
    """Move an admin-board card to another column."""
    task, organization = await require_task(db, task_id)
    task.status = status
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()
    counts = await comment_counts(db, [task.id])
    return _task_response(task, organization.name, counts.get(task.id, 0))


def chart_buckets(kind: str, now: datetime) -> list[tuple[datetime, datetime, str, str]]:
    """Build daily, weekly, or monthly buckets ending today in the report timezone."""
    if kind not in RANGES:
        raise BadRequestException("Date range must be daily, weekly, or monthly")
    local_now = now.astimezone(report_zone())
    today = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    if kind == "weekly":
        start = today - timedelta(days=today.weekday()) - timedelta(weeks=11)
        buckets = []
        for index in range(12):
            begin = start + timedelta(weeks=index)
            end = begin + timedelta(weeks=1)
            buckets.append((begin, end, begin.strftime("%d %b"), f"Week of {begin.strftime('%d %b %Y')}"))
        return buckets
    if kind == "monthly":
        month = today.replace(day=1)
        start_month = month.month - 11
        year = month.year
        while start_month <= 0:
            start_month += 12
            year -= 1
        begin = month.replace(year=year, month=start_month)
        buckets = []
        for _ in range(12):
            if begin.month == 12:
                end = begin.replace(year=begin.year + 1, month=1)
            else:
                end = begin.replace(month=begin.month + 1)
            buckets.append((begin, end, begin.strftime("%b %Y"), begin.strftime("%B %Y")))
            begin = end
        return buckets
    start = today - timedelta(days=13)
    buckets = []
    for index in range(14):
        begin = start + timedelta(days=index)
        end = begin + timedelta(days=1)
        buckets.append((begin, end, begin.strftime("%d %b"), begin.strftime("%A, %d %b %Y")))
    return buckets


def hours_by_user(
    entries: list[tuple[uuid.UUID, datetime, datetime | None]],
    buckets: list[tuple[datetime, datetime, str, str]],
    now: datetime,
) -> dict[uuid.UUID, list[float]]:
    """Split each time entry across the chart buckets."""
    totals = {}
    for user_id, started_at, ended_at in entries:
        hours = totals.setdefault(user_id, [0.0] * len(buckets))
        for index, (begin, end, _, _) in enumerate(buckets):
            seconds = overlap_seconds(started_at, ended_at, begin, end, now)
            if seconds > 0:
                hours[index] += seconds / 3600
    return {user_id: [round(value, 2) for value in values] for user_id, values in totals.items()}


async def list_time_entries(
    db: AsyncSession,
    admin: User,
    organization_id: uuid.UUID | None,
    user_id: uuid.UUID | None,
    date_range: str,
    page: int,
    page_size: int,
) -> AdminTimeLogPage:
    """Return one organization's chart and a page of time logs for the selected range."""
    organization_id = organization_id or admin.organization_id
    now = datetime.now(timezone.utc)
    buckets = chart_buckets(date_range, now)
    range_start = buckets[0][0]
    range_end = buckets[-1][1]
    employees = select(User.id).where(User.organization_id == organization_id, User.role != "admin")
    if user_id is not None:
        employees = employees.where(User.id == user_id)
    people_query = select(User).where(User.id.in_(employees)).order_by(User.first_name, User.last_name)
    people = list((await db.execute(people_query)).scalars().all())
    overlap = or_(TimeEntry.ended_at.is_(None), TimeEntry.ended_at > range_start)
    window = (
        TimeEntry.organization_id == organization_id,
        TimeEntry.started_at < range_end,
        overlap,
        TimeEntry.user_id.in_(employees),
    )
    chart_rows = (
        await db.execute(select(TimeEntry.user_id, TimeEntry.started_at, TimeEntry.ended_at).where(*window))
    ).all()
    grouped = hours_by_user(list(chart_rows), buckets, now)
    series = []
    for person in people:
        minimum, maximum = user_day_limits(person)
        logged = grouped.get(person.id, [0.0] * len(buckets))
        series.append(
            AdminTimeLogSeries(
                user_id=person.id,
                user_name=f"{person.first_name} {person.last_name}".strip(),
                points=[
                    AdminTimeLogPoint(
                        label=label,
                        full=full,
                        hours=logged[index],
                        minimum_hours=round(minimum * max(1, round((end - begin).total_seconds() / 86400)), 2),
                        maximum_hours=round(maximum * max(1, round((end - begin).total_seconds() / 86400)), 2),
                    )
                    for index, (begin, end, label, full) in enumerate(buckets)
                ],
            )
        )
    total = int(await db.scalar(select(func.count()).select_from(TimeEntry).where(*window)) or 0)
    offset = (page - 1) * page_size
    query = (
        select(TimeEntry, User, Organization.name, Task)
        .join(User, TimeEntry.user_id == User.id)
        .join(Organization, TimeEntry.organization_id == Organization.id)
        .outerjoin(Task, TimeEntry.task_id == Task.id)
        .where(*window)
        .order_by(TimeEntry.started_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = (await db.execute(query)).all()
    entry_ids = [entry.id for entry, _, _, _ in rows]
    counts: dict[uuid.UUID, int] = {}
    if entry_ids:
        count_rows = (
            await db.execute(
                select(Screenshot.time_entry_id, func.count())
                .where(Screenshot.time_entry_id.in_(entry_ids))
                .group_by(Screenshot.time_entry_id)
            )
        ).all()
        counts = {time_entry_id: int(shots) for time_entry_id, shots in count_rows if time_entry_id is not None}
    items = [
        AdminTimeEntryResponse(
            id=entry.id,
            user_id=person.id,
            user_name=f"{person.first_name} {person.last_name}".strip(),
            organization_id=entry.organization_id,
            organization_name=organization_name,
            task_id=entry.task_id,
            task_key=task.key if task else None,
            task_title=task.title if task else None,
            started_at=entry.started_at,
            ended_at=entry.ended_at,
            screenshot_count=counts.get(entry.id, 0),
        )
        for entry, person, organization_name, task in rows
    ]
    return AdminTimeLogPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        range=date_range,
        series=series,
    )


async def list_screenshots(
    db: AsyncSession,
    organization_id: uuid.UUID | None,
    user_id: uuid.UUID | None,
) -> list[AdminScreenshotResponse]:
    """Return recent screenshots with the person and task they were taken during."""
    query = (
        select(Screenshot, User, Organization.name, Task.key)
        .join(User, Screenshot.user_id == User.id)
        .join(Organization, Screenshot.organization_id == Organization.id)
        .outerjoin(TimeEntry, Screenshot.time_entry_id == TimeEntry.id)
        .outerjoin(Task, TimeEntry.task_id == Task.id)
        .order_by(Screenshot.taken_at.desc())
        .limit(60)
    )
    if organization_id is not None:
        query = query.where(Screenshot.organization_id == organization_id)
    if user_id is not None:
        query = query.where(Screenshot.user_id == user_id)
    rows = (await db.execute(query)).all()
    return [
        AdminScreenshotResponse(
            id=shot.id,
            user_id=person.id,
            user_name=f"{person.first_name} {person.last_name}".strip(),
            organization_id=shot.organization_id,
            organization_name=organization_name,
            time_entry_id=shot.time_entry_id,
            task_key=task_key,
            taken_at=shot.taken_at,
        )
        for shot, person, organization_name, task_key in rows
    ]


async def list_entry_screenshots(db: AsyncSession, time_entry_id: uuid.UUID) -> list[AdminScreenshotResponse]:
    """Return the screenshots captured during one time log."""
    entry = await db.get(TimeEntry, time_entry_id)
    if entry is None:
        raise NotFoundException("Time entry not found")
    query = (
        select(Screenshot, User, Organization.name, Task.key)
        .join(User, Screenshot.user_id == User.id)
        .join(Organization, Screenshot.organization_id == Organization.id)
        .join(TimeEntry, Screenshot.time_entry_id == TimeEntry.id)
        .outerjoin(Task, TimeEntry.task_id == Task.id)
        .where(Screenshot.time_entry_id == entry.id)
        .order_by(Screenshot.taken_at.asc())
        .limit(200)
    )
    rows = (await db.execute(query)).all()
    return [
        AdminScreenshotResponse(
            id=shot.id,
            user_id=person.id,
            user_name=f"{person.first_name} {person.last_name}".strip(),
            organization_id=shot.organization_id,
            organization_name=organization_name,
            time_entry_id=shot.time_entry_id,
            task_key=task_key,
            taken_at=shot.taken_at,
        )
        for shot, person, organization_name, task_key in rows
    ]


async def screenshot_path(db: AsyncSession, screenshot_id: uuid.UUID):
    """Return the file for any user's screenshot."""
    shot = await db.get(Screenshot, screenshot_id)
    if shot is None:
        raise NotFoundException("Screenshot not found")
    path = resolve_stored_file(shot.stored_path)
    if not path.is_file():
        raise NotFoundException("Screenshot file is missing")
    return path
