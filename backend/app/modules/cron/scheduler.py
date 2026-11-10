import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.modules.cron.daily_report import report_zone, send_daily_hours_report

logger = logging.getLogger("uvicorn.error")

_scheduler: AsyncIOScheduler | None = None


async def start_scheduler() -> None:
    """Start the daily end-of-day email on the application event loop."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        return
    settings = get_settings()
    loop = asyncio.get_running_loop()
    zone = report_zone()
    _scheduler = AsyncIOScheduler(
        event_loop=loop,
        timezone=settings.REPORT_TIMEZONE,
        job_defaults={
            "coalesce": True,
            "max_instances": 1,
            "misfire_grace_time": 3600,
        },
    )
    _scheduler.add_job(
        send_daily_hours_report,
        "cron",
        hour=settings.REPORT_HOUR,
        minute=settings.REPORT_MINUTE,
        id="daily_hours_email",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        "Daily hours email scheduled at %02d:%02d %s",
        settings.REPORT_HOUR,
        settings.REPORT_MINUTE,
        zone,
    )


def stop_scheduler() -> None:
    """Stop the scheduler when the application shuts down."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None
