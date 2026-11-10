import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TokenResponse(BaseModel):
    """JWT returned after a successful sign-in."""

    model_config = ConfigDict(populate_by_name=True)

    access_token: str = Field(serialization_alias="accessToken")
    token_type: str = Field(default="bearer", serialization_alias="tokenType")


class LoginRequest(BaseModel):
    """Email and password submitted from the employee sign-in form."""

    email: EmailStr
    password: str = Field(min_length=4, max_length=128)


class UserResponse(BaseModel):
    """Public profile for the signed-in user."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    organization_id: uuid.UUID = Field(serialization_alias="organizationId")
    first_name: str = Field(serialization_alias="firstName")
    last_name: str = Field(serialization_alias="lastName")
    email: EmailStr
    role: str = Field(serialization_alias="systemRole")
    job_title: str = Field(serialization_alias="jobTitle")
    organization_name: str = Field(serialization_alias="organizationName")
    daily_target_hours: float = Field(serialization_alias="dailyTargetHours")


class UserUpdate(BaseModel):
    """Fields an employee can change from settings."""

    model_config = ConfigDict(populate_by_name=True)

    first_name: str = Field(alias="firstName", min_length=1, max_length=80)
    last_name: str = Field(alias="lastName", min_length=1, max_length=80)
    email: EmailStr
    job_title: str = Field(alias="jobTitle", min_length=1, max_length=120)
    daily_target_hours: float = Field(alias="dailyTargetHours", ge=1, le=16)
