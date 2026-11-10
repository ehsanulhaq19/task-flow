import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.exceptions import BadRequestException
from app.database import async_session
from app.modules.auth.models import User
from app.modules.email.crud import successful_log_exists
from app.modules.email.service import EmailService
from app.modules.time_entry.models import TimeEntry

logger = logging.getLogger("uvicorn.error")


def report_zone():
    """Return the timezone used to decide when a day ends."""
    name = get_settings().REPORT_TIMEZONE
    try:
        return ZoneInfo(name)
    except Exception:
        logger.warning("Unknown REPORT_TIMEZONE %s, using UTC", name)
        return ZoneInfo("UTC")


def overlap_seconds(
    started_at: datetime,
    ended_at: datetime | None,
    day_start: datetime,
    day_end: datetime,
    now: datetime,
) -> float:
    """Seconds of a time entry that fall inside the report day."""
    start = max(started_at.astimezone(day_start.tzinfo), day_start)
    stop = min((ended_at or now).astimezone(day_start.tzinfo), day_end, now.astimezone(day_start.tzinfo))
    if stop <= start:
        return 0
    return (stop - start).total_seconds()


def format_hours(seconds: float) -> str:
    """Render a duration as hours and minutes."""
    total_minutes = max(0, round(seconds / 60))
    hours, minutes = divmod(total_minutes, 60)
    if hours == 0:
        return f"{minutes}m"
    if minutes == 0:
        return f"{hours}h"
    return f"{hours}h {minutes}m"


def format_clock(moment: datetime, zone: ZoneInfo) -> str:
    """Render a local time as HH:MM."""
    local = moment.astimezone(zone)
    return local.strftime("%H:%M")


def build_report(users: list[User], entries_by_user: dict, day_start: datetime, day_end: datetime, now: datetime) -> str:
    """Plain-text daily report of active users and the hours they logged."""
    zone = day_start.tzinfo
    lines = [
        f"Taskflow daily time report — {day_start.strftime('%d %b %Y')}",
        f"Day: {day_start.strftime('%A, %d %B %Y')} ({zone})",
        "",
    ]
    if not users:
        lines.append("No active users.")
        return "\n".join(lines)

    for user in users:
        sessions = entries_by_user.get(user.id, [])
        total = 0.0
        ranges: list[str] = []
        for entry in sessions:
            seconds = overlap_seconds(entry.started_at, entry.ended_at, day_start, day_end, now)
            if seconds <= 0:
                continue
            total += seconds
            visible_start = max(entry.started_at.astimezone(zone), day_start)
            visible_end = min((entry.ended_at or now).astimezone(zone), day_end, now.astimezone(zone))
            ranges.append(f"{format_clock(visible_start, zone)}–{format_clock(visible_end, zone)}")
        lines.extend(
            [
                f"{user.first_name} {user.last_name}".strip(),
                f"Organization: {user.organization_name}",
                f"Date: {day_start.strftime('%d %b %Y')}",
                f"Time: {', '.join(ranges) if ranges else 'No time logged'}",
                f"Logged hours: {format_hours(total)}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


async def send_daily_hours_report(now: datetime | None = None) -> None:
    """Email every active admin the day's hours for every active user."""
    moment = now or datetime.now(timezone.utc)
    zone = report_zone()
    local = moment.astimezone(zone)
    settings = get_settings()
    scheduled = (settings.REPORT_HOUR, settings.REPORT_MINUTE)
    if (local.hour, local.minute) < scheduled:
        local = local - timedelta(days=1)
    day_start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    subject = f"Taskflow daily time report — {day_start.strftime('%d %b %Y')}"

    async with async_session() as db:
        try:
            users = await _active_users(db)
            entries = await _entries_for_day(db, [user.id for user in users], day_start, day_end)
            body = build_report(users, entries, day_start, day_end, moment)
            admins = [user for user in users if user.role == "admin" and user.email]
            if not admins:
                logger.info("Daily time report skipped: no active admin to receive it")
                return
            service = EmailService()
            for admin in admins:
                if await successful_log_exists(db, subject, admin.email):
                    logger.info("Daily time report already sent to %s for %s", admin.email, day_start.date())
                    continue
                result = await service.send_email(
                    recipient=admin.email,
                    subject=subject,
                    content=body,
                    raise_on_failure=False,
                )
                logger.info("Daily time report to %s: %s", admin.email, result["status"])
        except BadRequestException:
            logger.warning("Daily time report skipped because SMTP is not configured")
        except Exception:
            logger.exception("Daily time report failed")
            await db.rollback()


async def _active_users(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User).where(User.is_active.is_(True)).options(selectinload(User.organization)).order_by(User.first_name, User.last_name)
    )
    return list(result.scalars().all())


async def _entries_for_day(db: AsyncSession, user_ids: list, day_start: datetime, day_end: datetime) -> dict:
    if not user_ids:
        return {}
    result = await db.execute(
        select(TimeEntry)
        .where(
            TimeEntry.user_id.in_(user_ids),
            TimeEntry.started_at < day_end,
            or_(TimeEntry.ended_at.is_(None), TimeEntry.ended_at > day_start),
        )
        .order_by(TimeEntry.started_at)
    )
    grouped: dict = {}
    for entry in result.scalars().all():
        grouped.setdefault(entry.user_id, []).append(entry)
    return grouped
