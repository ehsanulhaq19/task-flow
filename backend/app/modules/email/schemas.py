from pydantic import BaseModel, EmailStr, Field


class SendEmailRequest(BaseModel):
    """Fields required to send one email."""

    recipient: EmailStr
    subject: str = Field(min_length=1)
    content: str


class SendEmailResponse(BaseModel):
    """Result returned after a send attempt."""

    success: bool
    message: str
