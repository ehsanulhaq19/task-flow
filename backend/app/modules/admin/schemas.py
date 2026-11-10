import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.markdown import normalize_markdown
from app.modules.task.schemas import Priority, TaskStatus


class AdminSummary(BaseModel):
    """Counts shown on the admin overview."""

    model_config = ConfigDict(populate_by_name=True)

    organizations: int
    users: int
    employees: int
    tasks: int
    open_timers: int = Field(serialization_alias="openTimers")
    screenshots: int


class OrganizationResponse(BaseModel):
    """Organization row for the admin panel."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    name: str
    slug: str
    created_at: datetime = Field(serialization_alias="createdAt")


class OrganizationCreate(BaseModel):
    """Name and optional slug for a new organization."""

    name: str = Field(min_length=2, max_length=200)
    slug: str | None = Field(default=None, max_length=100)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Reject a blank organization name."""
        text = value.strip()
        if len(text) < 2:
            raise ValueError("must be at least 2 characters")
        return text

    @field_validator("slug")
    @classmethod
    def strip_slug(cls, value: str | None) -> str | None:
        """Keep a provided slug without surrounding space."""
        if value is None:
            return None
        text = value.strip().lower()
        return text or None


class UserCreate(BaseModel):
    """New admin or employee assigned to an organization."""

    model_config = ConfigDict(populate_by_name=True)

    first_name: str = Field(alias="firstName", min_length=1, max_length=80)
    last_name: str = Field(alias="lastName", min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=4, max_length=128)
    role: Literal["admin", "employee"] = "employee"
    organization_id: uuid.UUID = Field(alias="organizationId")
    job_title: str = Field(default="Team member", alias="jobTitle", max_length=120)

    @field_validator("first_name", "last_name", "job_title")
    @classmethod
    def strip_text(cls, value: str) -> str:
        """Store names and titles without surrounding space."""
        return value.strip()


class AdminTaskCreate(BaseModel):
    """Task created by an admin and assigned to someone in an organization."""

    model_config = ConfigDict(populate_by_name=True)

    organization_id: uuid.UUID = Field(alias="organizationId")
    assignee_user_id: uuid.UUID = Field(alias="assigneeUserId")
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    status: TaskStatus = "todo"
    priority: Priority = "medium"
    labels: list[str] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        """Reject a blank title."""
        text = value.strip()
        if not text:
            raise ValueError("must not be empty")
        return text

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        """Store the description as Markdown."""
        text = normalize_markdown(value)
        if len(text) > 5000:
            raise ValueError("must be at most 5000 characters")
        return text

    @field_validator("labels")
    @classmethod
    def clean_labels(cls, value: list[str]) -> list[str]:
        """Keep up to four short labels."""
        cleaned: list[str] = []
        for item in value:
            label = item.strip()[:32]
            if label and label not in cleaned:
                cleaned.append(label)
            if len(cleaned) == 4:
                break
        return cleaned


class AdminTaskResponse(BaseModel):
    """Task row with its organization and assignee."""

    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    key: str
    title: str
    description: str
    status: str
    priority: str
    assignee: str
    assignee_user_id: uuid.UUID | None = Field(serialization_alias="assigneeUserId")
    organization_id: uuid.UUID = Field(serialization_alias="organizationId")
    organization_name: str = Field(serialization_alias="organizationName")
    comment_count: int = Field(default=0, serialization_alias="commentCount")
    labels: list[str]
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")

    @field_validator("description", mode="before")
    @classmethod
    def description_markdown(cls, value: str) -> str:
        """Return a description as Markdown, including older HTML."""
        return normalize_markdown(value or "")


class AdminTaskBulkDelete(BaseModel):
    """Task ids selected on the admin board."""

    ids: list[uuid.UUID] = Field(min_length=1, max_length=200)


class AdminTaskBulkDeleteResult(BaseModel):
    """How many selected tasks were deleted."""

    deleted: int


class AdminTaskMove(BaseModel):
    """New column for a card on the admin board."""

    status: TaskStatus


class AdminTaskUpdate(BaseModel):
    """Editable fields of a task an admin opened from the board."""

    model_config = ConfigDict(populate_by_name=True)

    assignee_user_id: uuid.UUID = Field(alias="assigneeUserId")
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    status: TaskStatus
    priority: Priority
    labels: list[str] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        """Reject a blank title."""
        text = value.strip()
        if not text:
            raise ValueError("must not be empty")
        return text

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        """Store the description as Markdown."""
        text = normalize_markdown(value)
        if len(text) > 5000:
            raise ValueError("must be at most 5000 characters")
        return text

    @field_validator("labels")
    @classmethod
    def clean_labels(cls, value: list[str]) -> list[str]:
        """Keep up to four short labels."""
        cleaned: list[str] = []
        for item in value:
            label = item.strip()[:32]
            if label and label not in cleaned:
                cleaned.append(label)
            if len(cleaned) == 4:
                break
        return cleaned


class TaskImportError(BaseModel):
    """One CSV row that could not become a task."""

    row: int
    message: str


class TaskImportResult(BaseModel):
    """Tasks created from a CSV, plus the rows that were skipped."""

    model_config = ConfigDict(populate_by_name=True)

    created: list[AdminTaskResponse]
    errors: list[TaskImportError]


class AdminTimeEntryResponse(BaseModel):
    """One time entry with the person and task it belongs to."""

    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    user_id: uuid.UUID = Field(serialization_alias="userId")
    user_name: str = Field(serialization_alias="userName")
    organization_id: uuid.UUID = Field(serialization_alias="organizationId")
    organization_name: str = Field(serialization_alias="organizationName")
    task_id: uuid.UUID | None = Field(serialization_alias="taskId")
    task_key: str | None = Field(serialization_alias="taskKey")
    task_title: str | None = Field(serialization_alias="taskTitle")
    started_at: datetime = Field(serialization_alias="startedAt")
    ended_at: datetime | None = Field(serialization_alias="endedAt")
    screenshot_count: int = Field(serialization_alias="screenshotCount")


class AdminScreenshotResponse(BaseModel):
    """Screenshot metadata for the admin gallery."""

    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    user_id: uuid.UUID = Field(serialization_alias="userId")
    user_name: str = Field(serialization_alias="userName")
    organization_id: uuid.UUID = Field(serialization_alias="organizationId")
    organization_name: str = Field(serialization_alias="organizationName")
    time_entry_id: uuid.UUID | None = Field(serialization_alias="timeEntryId")
    task_key: str | None = Field(serialization_alias="taskKey")
    taken_at: datetime = Field(serialization_alias="takenAt")
