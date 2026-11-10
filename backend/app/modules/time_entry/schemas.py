import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TimeStart(BaseModel):
    """Task the timer should attach to."""

    model_config = ConfigDict(populate_by_name=True)

    task_id: uuid.UUID = Field(alias="taskId")


class TimeSessionResponse(BaseModel):
    """One of the signed-in employee's time entries."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    task_id: uuid.UUID | None = Field(serialization_alias="taskId")
    started_at: datetime = Field(serialization_alias="startedAt")
    ended_at: datetime | None = Field(serialization_alias="endedAt")
