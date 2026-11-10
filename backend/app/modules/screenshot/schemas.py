import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ScreenshotResponse(BaseModel):
    """Metadata for a screenshot stored on the server."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    taken_at: datetime = Field(serialization_alias="takenAt")
