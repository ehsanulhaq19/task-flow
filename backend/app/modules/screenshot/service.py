import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import BadRequestException, NotFoundException
from app.modules.auth.models import User
from app.modules.screenshot.models import Screenshot
from app.modules.time_entry.models import TimeEntry

MAX_BYTES = 8 * 1024 * 1024
ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def parse_taken_at(value: str | None) -> datetime:
    """Parse the client timestamp, falling back to the current time."""
    if not value:
        return datetime.now(timezone.utc)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise BadRequestException("takenAt must be an ISO timestamp")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def screenshot_root() -> Path:
    """Directory on the host mount where screenshot files are written."""
    root = Path(get_settings().SCREENSHOT_DIR).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def resolve_stored_file(stored_path: str) -> Path:
    """Resolve a stored relative path and refuse anything outside the screenshot directory."""
    root = screenshot_root()
    path = (root / stored_path).resolve()
    if not path.is_relative_to(root):
        raise NotFoundException("Screenshot not found")
    return path


async def save_screenshot(db: AsyncSession, user: User, upload: UploadFile, taken_at_raw: str | None) -> Screenshot:
    """Write an uploaded frame under the screenshot directory and record it."""
    extension = ALLOWED_TYPES.get(upload.content_type or "")
    if extension is None:
        raise BadRequestException("Screenshot must be a JPEG, PNG, or WebP image")

    contents = await upload.read(MAX_BYTES + 1)
    if not contents:
        raise BadRequestException("Screenshot file is empty")
    if len(contents) > MAX_BYTES:
        raise BadRequestException("Screenshot is too large")

    taken_at = parse_taken_at(taken_at_raw)
    open_entry = await db.scalar(
        select(TimeEntry)
        .where(TimeEntry.user_id == user.id, TimeEntry.ended_at.is_(None))
        .order_by(TimeEntry.started_at.desc())
    )

    screenshot_id = uuid.uuid4()
    relative = Path(str(user.id)) / f"{screenshot_id}{extension}"
    destination = resolve_stored_file(str(relative))
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(contents)

    screenshot = Screenshot(
        id=screenshot_id,
        organization_id=user.organization_id,
        user_id=user.id,
        time_entry_id=open_entry.id if open_entry else None,
        stored_path=relative.as_posix(),
        taken_at=taken_at,
    )
    db.add(screenshot)
    await db.flush()
    await db.refresh(screenshot)
    return screenshot


async def list_screenshots(db: AsyncSession, user: User) -> list[Screenshot]:
    """Return the employee's newest screenshots."""
    result = await db.execute(
        select(Screenshot).where(Screenshot.user_id == user.id).order_by(Screenshot.taken_at.desc()).limit(100)
    )
    return list(result.scalars().all())


async def screenshot_file(db: AsyncSession, user: User, screenshot_id: uuid.UUID) -> Path:
    """Return the file path for a screenshot owned by the employee."""
    screenshot = await db.scalar(
        select(Screenshot).where(Screenshot.id == screenshot_id, Screenshot.user_id == user.id)
    )
    if screenshot is None:
        raise NotFoundException("Screenshot not found")
    path = resolve_stored_file(screenshot.stored_path)
    if not path.is_file():
        raise NotFoundException("Screenshot file is missing")
    return path
