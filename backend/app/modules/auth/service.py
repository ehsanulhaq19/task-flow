from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, UnauthorizedException
from app.core.security import create_access_token, verify_password
from app.modules.auth.crud import get_user_by_email
from app.modules.auth.models import User
from app.modules.auth.schemas import LoginRequest, UserUpdate


async def authenticate(db: AsyncSession, payload: LoginRequest) -> str:
    """Check credentials and return a JWT. Admins can sign in; employee routes still reject them."""
    user = await get_user_by_email(db, str(payload.email))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise UnauthorizedException("Incorrect email or password")
    if not user.is_active:
        raise UnauthorizedException("User account is inactive")
    return create_access_token({"sub": str(user.id)})


async def update_profile(db: AsyncSession, user: User, payload: UserUpdate) -> User:
    """Update the signed-in employee's profile and daily hour target."""
    email = str(payload.email).lower()
    existing = await get_user_by_email(db, email)
    if existing is not None and existing.id != user.id:
        raise ConflictException("That email is already in use")

    user.email = email
    user.first_name = payload.first_name.strip()
    user.last_name = payload.last_name.strip()
    user.job_title = payload.job_title.strip()
    user.daily_target_hours = payload.daily_target_hours
    user.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return user
