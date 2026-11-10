from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_employee
from app.modules.auth.models import User
from app.modules.time_entry.schemas import TimeSessionResponse, TimeStart
from app.modules.time_entry.service import sessions_for, start_timer, stop_timer

router = APIRouter()


@router.get("/sessions", response_model=list[TimeSessionResponse])
async def read_sessions(
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """List the signed-in employee's time entries."""
    return await sessions_for(db, user)


@router.post("/start", response_model=list[TimeSessionResponse])
async def time_in(
    payload: TimeStart,
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Start the timer on an in-progress task."""
    return await start_timer(db, user, payload)


@router.post("/stop", response_model=list[TimeSessionResponse])
async def time_out(
    user: User = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Stop the employee's open timer."""
    return await stop_timer(db, user)
