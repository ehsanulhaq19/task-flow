import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.markdown import markdown_visible, normalize_markdown

TaskStatus = Literal["backlog", "todo", "in_progress", "in_review", "done"]
Priority = Literal["low", "medium", "high", "urgent"]


class TaskResponse(BaseModel):
    """Kanban card returned to the employee board."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    key: str
    title: str
    description: str
    status: TaskStatus
    priority: Priority
    assignee: str
    assignee_user_id: uuid.UUID | None = Field(serialization_alias="assigneeUserId")
    comment_count: int = Field(default=0, serialization_alias="commentCount")
    labels: list[str]
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")

    @field_validator("description", mode="before")
    @classmethod
    def description_markdown(cls, value: str) -> str:
        """Return a description as Markdown, including older HTML."""
        return normalize_markdown(value or "")


class AssigneeOption(BaseModel):
    """A person in the same organization who can be assigned a task."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    first_name: str = Field(serialization_alias="firstName")
    last_name: str = Field(serialization_alias="lastName")


class TaskWrite(BaseModel):
    """Fields the board form can create or replace."""

    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    status: TaskStatus
    priority: Priority
    assignee_user_id: uuid.UUID = Field(alias="assigneeUserId")
    labels: list[str] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def strip_required(cls, value: str) -> str:
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
        """Keep up to four short, unique labels."""
        cleaned: list[str] = []
        for item in value:
            label = item.strip()[:32]
            if label and label not in cleaned:
                cleaned.append(label)
            if len(cleaned) == 4:
                break
        return cleaned


class TaskMove(BaseModel):
    """New column for a dragged card."""

    status: TaskStatus


class TaskCommentCreate(BaseModel):
    """Markdown body submitted from the task modal."""

    body: str = Field(min_length=1, max_length=20000)

    @field_validator("body")
    @classmethod
    def markdown_body(cls, value: str) -> str:
        """Store the comment as Markdown with visible text."""
        text = normalize_markdown(value)
        if not markdown_visible(text):
            raise ValueError("Write a comment")
        if len(text) > 20000:
            raise ValueError("Comment is too long")
        return text


class TaskCommentResponse(BaseModel):
    """One comment shown under a task."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    task_id: uuid.UUID = Field(serialization_alias="taskId")
    author_name: str = Field(serialization_alias="authorName")
    body: str
    created_at: datetime = Field(serialization_alias="createdAt")

    @field_validator("body", mode="before")
    @classmethod
    def body_markdown(cls, value: str) -> str:
        """Return a comment as Markdown, including older HTML."""
        return normalize_markdown(value or "")
