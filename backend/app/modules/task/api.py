import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_employee
from app.modules.auth.models import User
from app.modules.task.schemas import (
    AssigneeOption,
    TaskCommentCreate,
    TaskCommentResponse,
    TaskMove,
    TaskResponse,
    TaskWrite,
)
from app.modules.task.service import (
    add_comment,
    create_task,
    list_assignees,
    list_board,
    list_comments,
    move_task,
    remove_task,
    replace_task,
)

router = APIRouter()


@router.get("", response_model=list[TaskResponse])
async def read_tasks(
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
) -> list:
    """List every task on the employee's organization board."""
    return await list_board(db, user)


@router.get("/assignees", response_model=list[AssigneeOption])
async def read_assignees(
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
) -> list[User]:
    """List people in the signed-in employee's organization."""
    return await list_assignees(db, user)


@router.post("", response_model=TaskResponse, status_code=201)
async def add_task(
    payload: TaskWrite,
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Create a task. The server assigns the TF key."""
    return await create_task(db, user, payload)


@router.get("/{task_id}/comments", response_model=list[TaskCommentResponse])
async def read_comments(
    task_id: uuid.UUID,
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
) -> list:
    """List comments on a task."""
    return await list_comments(db, user, task_id)


@router.post("/{task_id}/comments", response_model=TaskCommentResponse, status_code=201)
async def create_comment(
    task_id: uuid.UUID,
    payload: TaskCommentCreate,
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Add a rich-text comment to a task."""
    return await add_comment(db, user, task_id, payload)


@router.put("/{task_id}", response_model=TaskResponse)
async def edit_task(
    task_id: uuid.UUID,
    payload: TaskWrite,
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Update a task on the organization board."""
    return await replace_task(db, user, task_id, payload)


@router.patch("/{task_id}", response_model=TaskResponse)
async def change_status(
    task_id: uuid.UUID,
    payload: TaskMove,
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Move a task to another Kanban column."""
    return await move_task(db, user, task_id, payload)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: uuid.UUID,
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a task from the organization board."""
    await remove_task(db, user, task_id)
