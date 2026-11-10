import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.email.models import EmailLog


async def create_email_log(db: AsyncSession, data: dict) -> EmailLog:
    """Store one send attempt."""
    email_log = EmailLog(**data)
    db.add(email_log)
    await db.flush()
    await db.refresh(email_log)
    return email_log


async def get_email_log_by_id(db: AsyncSession, email_log_id: uuid.UUID) -> EmailLog | None:
    """Return one email log."""
    return await db.get(EmailLog, email_log_id)


async def successful_log_exists(db: AsyncSession, subject: str, to_email: str | None = None) -> bool:
    """Return whether this subject was already sent successfully."""
    statement = select(EmailLog.id).where(EmailLog.subject == subject, EmailLog.status == "success")
    if to_email is not None:
        statement = statement.where(EmailLog.to_email == to_email)
    result = await db.scalar(statement.limit(1))
    return result is not None
