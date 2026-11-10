import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import verify_token
from app.database import get_db
from app.modules.auth.crud import get_user_by_id
from app.modules.auth.models import User

http_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate the bearer token and return the active user it belongs to."""
    try:
        payload = verify_token(credentials.credentials)
        user_id = uuid.UUID(str(payload.get("sub")))
    except (JWTError, ValueError, TypeError):
        raise UnauthorizedException("Invalid authentication token")

    user = await get_user_by_id(db, user_id)
    if user is None:
        raise UnauthorizedException("User not found")
    if not user.is_active:
        raise UnauthorizedException("User account is inactive")
    return user


async def get_current_employee(user: User = Depends(get_current_user)) -> User:
    """Allow only employee accounts into the workspace routes."""
    if user.role != "employee":
        raise ForbiddenException("This app is for employee accounts")
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """Allow only admin accounts into the admin panel routes."""
    if user.role != "admin":
        raise ForbiddenException("Admin access is required")
    return user
