import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, NotFoundException
from app.modules.auth.models import User
from app.modules.task.crud import get_task, list_task_keys, list_tasks
from app.modules.task.models import Task, TaskComment
from app.modules.task.schemas import TaskCommentCreate, TaskMove, TaskWrite


def next_task_key(keys: list[str]) -> str:
    """Return the next TF-n key above the highest existing number."""
    highest = 100
    for key in keys:
        prefix, _, raw = key.partition("-")
        if prefix == "TF" and raw.isdigit():
            highest = max(highest, int(raw))
    return f"TF-{highest + 1}"


async def comment_counts(db: AsyncSession, task_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Return how many comments each task has."""
    if not task_ids:
        return {}
    rows = (
        await db.execute(
            select(TaskComment.task_id, func.count())
            .where(TaskComment.task_id.in_(task_ids))
            .group_by(TaskComment.task_id)
        )
    ).all()
    return {task_id: int(total) for task_id, total in rows}


async def list_board(db: AsyncSession, user: User) -> list[Task]:
    """Return the organization board for an employee."""
    tasks = await list_tasks(db, user.organization_id)
    counts = await comment_counts(db, [task.id for task in tasks])
    for task in tasks:
        task.comment_count = counts.get(task.id, 0)
    return tasks


async def require_task(db: AsyncSession, user: User, task_id: uuid.UUID) -> Task:
    """Return an organization task or raise 404."""
    task = await get_task(db, user.organization_id, task_id)
    if task is None:
        raise NotFoundException("Task not found")
    return task


async def list_assignees(db: AsyncSession, user: User) -> list[User]:
    """Return active people in the signed-in user's organization."""
    result = await db.execute(
        select(User)
        .where(User.organization_id == user.organization_id, User.is_active.is_(True))
        .order_by(User.first_name, User.last_name)
    )
    return list(result.scalars().all())


async def require_assignee(db: AsyncSession, organization_id: uuid.UUID, user_id: uuid.UUID) -> User:
    """Return an active teammate, or reject an assignee from another organization."""
    assignee = await db.get(User, user_id)
    if assignee is None or assignee.organization_id != organization_id or not assignee.is_active:
        raise BadRequestException("Choose a person from this organization")
    return assignee


async def create_task(db: AsyncSession, user: User, payload: TaskWrite) -> Task:
    """Add a card and assign the next task key in the organization."""
    assignee = await require_assignee(db, user.organization_id, payload.assignee_user_id)
    task = Task(
        organization_id=user.organization_id,
        key=next_task_key(await list_task_keys(db, user.organization_id)),
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
    return task


async def replace_task(db: AsyncSession, user: User, task_id: uuid.UUID, payload: TaskWrite) -> Task:
    """Replace the editable fields of a card. The key stays the same."""
    task = await require_task(db, user, task_id)
    assignee = await require_assignee(db, user.organization_id, payload.assignee_user_id)
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
    return task


async def move_task(db: AsyncSession, user: User, task_id: uuid.UUID, payload: TaskMove) -> Task:
    """Move a card to another column."""
    task = await require_task(db, user, task_id)
    task.status = payload.status
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(task)
    return task


async def remove_task(db: AsyncSession, user: User, task_id: uuid.UUID) -> None:
    """Delete a card. Linked time entries keep their history with no task."""
    task = await require_task(db, user, task_id)
    await db.delete(task)
    await db.flush()


async def list_comments(db: AsyncSession, user: User, task_id: uuid.UUID) -> list[TaskComment]:
    """Return comments on an organization task, oldest first."""
    await require_task(db, user, task_id)
    result = await db.execute(
        select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at.asc())
    )
    return list(result.scalars().all())


async def add_comment(db: AsyncSession, user: User, task_id: uuid.UUID, payload: TaskCommentCreate) -> TaskComment:
    """Store a Markdown comment on a task."""
    await require_task(db, user, task_id)
    comment = TaskComment(
        task_id=task_id,
        user_id=user.id,
        author_name=f"{user.first_name} {user.last_name}".strip(),
        body=payload.body,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return comment
