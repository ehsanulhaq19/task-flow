import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin
from app.modules.admin.schemas import (
    AdminScreenshotResponse,
    AdminSummary,
    AdminTaskBulkDelete,
    AdminTaskBulkDeleteResult,
    AdminTaskCreate,
    AdminTaskMove,
    AdminTaskResponse,
    AdminTaskUpdate,
    AdminTimeEntryResponse,
    OrganizationCreate,
    OrganizationResponse,
    TaskImportResult,
    UserCreate,
)
from app.modules.admin.service import (
    add_task_comment,
    create_organization,
    create_task,
    create_user,
    delete_task,
    delete_tasks,
    import_tasks_csv,
    list_task_comments,
    move_task,
    update_task,
    list_organizations,
    list_entry_screenshots,
    list_screenshots,
    list_tasks,
    list_time_entries,
    list_users,
    screenshot_path,
    summary,
)
from app.modules.task.schemas import TaskCommentCreate, TaskCommentResponse
from app.modules.auth.models import User
from app.modules.auth.schemas import UserResponse

router = APIRouter()


@router.get("/summary", response_model=AdminSummary)
async def read_summary(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return the counts for the admin overview."""
    return await summary(db)


@router.get("/organizations", response_model=list[OrganizationResponse])
async def read_organizations(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List organizations."""
    return await list_organizations(db)


@router.post("/organizations", response_model=OrganizationResponse, status_code=201)
async def add_organization(
    payload: OrganizationCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create an organization."""
    return await create_organization(db, payload)


@router.get("/users", response_model=list[UserResponse])
async def read_users(
    organization_id: uuid.UUID | None = Query(None, alias="organizationId"),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List users, optionally within one organization."""
    return await list_users(db, organization_id)


@router.post("/users", response_model=UserResponse, status_code=201)
async def add_user(
    payload: UserCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a user and assign them to an organization."""
    return await create_user(db, payload)


@router.get("/tasks", response_model=list[AdminTaskResponse])
async def read_tasks(
    organization_id: uuid.UUID | None = Query(None, alias="organizationId"),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List tasks across organizations."""
    return await list_tasks(db, organization_id)


@router.post("/tasks", response_model=AdminTaskResponse, status_code=201)
async def add_task(
    payload: AdminTaskCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a task and assign it to a user in that organization."""
    return await create_task(db, payload)


@router.post("/tasks/import", response_model=TaskImportResult)
async def import_tasks(
    file: UploadFile = File(...),
    organization_id: uuid.UUID | None = Form(default=None, alias="organizationId"),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create tasks from a CSV of name, description, assignee email, and priority."""
    content = await file.read(1_048_577)
    return await import_tasks_csv(db, content, file.filename or "", organization_id)


@router.patch("/tasks/{task_id}", response_model=AdminTaskResponse)
async def change_task_status(
    task_id: uuid.UUID,
    payload: AdminTaskMove,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Move a task to another Kanban column."""
    return await move_task(db, task_id, payload.status)


@router.put("/tasks/{task_id}", response_model=AdminTaskResponse)
async def edit_task(
    task_id: uuid.UUID,
    payload: AdminTaskUpdate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a task opened from the admin board."""
    return await update_task(db, task_id, payload)


@router.post("/tasks/bulk-delete", response_model=AdminTaskBulkDeleteResult)
async def remove_tasks(
    payload: AdminTaskBulkDelete,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete the tasks selected on the admin board."""
    deleted = await delete_tasks(db, payload.ids)
    return AdminTaskBulkDeleteResult(deleted=deleted)


@router.delete("/tasks/{task_id}", status_code=204)
async def remove_task(
    task_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a task from the admin board."""
    await delete_task(db, task_id)


@router.get("/tasks/{task_id}/comments", response_model=list[TaskCommentResponse])
async def read_task_comments(
    task_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List comments on a task."""
    return await list_task_comments(db, task_id)


@router.post("/tasks/{task_id}/comments", response_model=TaskCommentResponse, status_code=201)
async def create_task_comment(
    task_id: uuid.UUID,
    payload: TaskCommentCreate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add a rich-text comment to a task."""
    return await add_task_comment(db, admin, task_id, payload.body)


@router.get("/time-entries", response_model=list[AdminTimeEntryResponse])
async def read_time_entries(
    organization_id: uuid.UUID | None = Query(None, alias="organizationId"),
    user_id: uuid.UUID | None = Query(None, alias="userId"),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List time logs, filtered by organization or user."""
    return await list_time_entries(db, organization_id, user_id)


@router.get("/time-entries/{time_entry_id}/screenshots", response_model=list[AdminScreenshotResponse])
async def read_time_entry_screenshots(
    time_entry_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List screenshots captured during one time log."""
    return await list_entry_screenshots(db, time_entry_id)


@router.get("/screenshots", response_model=list[AdminScreenshotResponse])
async def read_screenshots(
    organization_id: uuid.UUID | None = Query(None, alias="organizationId"),
    user_id: uuid.UUID | None = Query(None, alias="userId"),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List screenshots, filtered by organization or user."""
    return await list_screenshots(db, organization_id, user_id)


@router.get("/screenshots/{screenshot_id}/file")
async def download_screenshot(
    screenshot_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Download a screenshot captured during someone's tracked time."""
    path: Path = await screenshot_path(db, screenshot_id)
    media = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    return FileResponse(path, media_type=media.get(path.suffix.lower(), "application/octet-stream"))
