from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException
from app.modules.auth.models import User
from app.modules.task.service import require_task
from app.modules.time_entry.crud import list_sessions, open_sessions
from app.modules.time_entry.models import TimeEntry
from app.modules.time_entry.schemas import TimeStart


async def sessions_for(db: AsyncSession, user: User) -> list[TimeEntry]:
    """Return the signed-in employee's time entries."""
    return await list_sessions(db, user.id)


async def start_timer(db: AsyncSession, user: User, payload: TimeStart) -> list[TimeEntry]:
    """Start a timer on an in-progress task, closing any open entry first."""
    task = await require_task(db, user, payload.task_id)
    if task.status != "in_progress":
        raise BadRequestException("Choose a task that is in progress")

    now = datetime.now(timezone.utc)
    for entry in await open_sessions(db, user.id):
        entry.ended_at = now

    db.add(
        TimeEntry(
            organization_id=user.organization_id,
            user_id=user.id,
            task_id=task.id,
            started_at=now,
            ended_at=None,
        )
    )
    await db.flush()
    return await list_sessions(db, user.id)


async def stop_timer(db: AsyncSession, user: User) -> list[TimeEntry]:
    """Close every open time entry for the employee."""
    now = datetime.now(timezone.utc)
    for entry in await open_sessions(db, user.id):
        entry.ended_at = now
    await db.flush()
    return await list_sessions(db, user.id)
