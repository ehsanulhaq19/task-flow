from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.auth.schemas import LoginRequest, TokenResponse, UserResponse, UserUpdate
from app.modules.auth.service import authenticate, update_profile

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Sign in an admin or an employee and return a bearer token."""
    token = await authenticate(db, payload)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def read_me(user: User = Depends(get_current_user)) -> User:
    """Return the signed-in user. Both roles can read their own profile."""
    return user


@router.put("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Update the signed-in user's name, email, job title, and daily target."""
    return await update_profile(db, user, payload)
