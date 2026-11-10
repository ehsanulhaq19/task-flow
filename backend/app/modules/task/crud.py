import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.task.models import Task


async def list_tasks(db: AsyncSession, organization_id: uuid.UUID) -> list[Task]:
    """Return every task on the organization's board, newest edits first."""
    result = await db.execute(
        select(Task).where(Task.organization_id == organization_id).order_by(Task.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_task(db: AsyncSession, organization_id: uuid.UUID, task_id: uuid.UUID) -> Task | None:
    """Return a task when it belongs to the organization."""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.organization_id == organization_id)
    )
    return result.scalar_one_or_none()


async def list_task_keys(db: AsyncSession, organization_id: uuid.UUID) -> list[str]:
    """Return task keys so the next TF number can be chosen."""
    result = await db.execute(select(Task.key).where(Task.organization_id == organization_id))
    return list(result.scalars().all())
