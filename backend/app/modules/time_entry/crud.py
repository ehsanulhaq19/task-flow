import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.time_entry.models import TimeEntry


async def list_sessions(db: AsyncSession, user_id: uuid.UUID, limit: int = 400) -> list[TimeEntry]:
    """Return the employee's newest time entries."""
    result = await db.execute(
        select(TimeEntry).where(TimeEntry.user_id == user_id).order_by(TimeEntry.started_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


async def open_sessions(db: AsyncSession, user_id: uuid.UUID) -> list[TimeEntry]:
    """Return time entries that have not been stopped."""
    result = await db.execute(
        select(TimeEntry).where(TimeEntry.user_id == user_id, TimeEntry.ended_at.is_(None))
    )
    return list(result.scalars().all())
