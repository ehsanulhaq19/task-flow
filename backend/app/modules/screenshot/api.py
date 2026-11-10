import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_employee
from app.modules.auth.models import User
from app.modules.screenshot.schemas import ScreenshotResponse
from app.modules.screenshot.service import list_screenshots, save_screenshot, screenshot_file

router = APIRouter()


@router.get("", response_model=list[ScreenshotResponse])
async def read_screenshots(
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """List screenshots captured for the signed-in employee."""
    return await list_screenshots(db, user)


@router.post("", response_model=ScreenshotResponse, status_code=201)
async def upload_screenshot(
    file: UploadFile = File(...),
    takenAt: str | None = Form(None),
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Store a screenshot on the server, outside the container writable layer."""
    return await save_screenshot(db, user, file, takenAt)


@router.get("/{screenshot_id}/file")
async def download_screenshot(
    screenshot_id: uuid.UUID,
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Download one of the signed-in employee's screenshot files."""
    path = await screenshot_file(db, user, screenshot_id)
    return FileResponse(path)
