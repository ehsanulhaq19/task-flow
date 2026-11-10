from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.exceptions import AppException, BadRequestException
from app.dependencies import get_current_admin
from app.modules.auth.models import User
from app.modules.email.schemas import SendEmailRequest, SendEmailResponse
from app.modules.email.service import EmailService

router = APIRouter()


def _validate_email_request(recipient: str, subject: str, content: str) -> None:
    """Reject a send request that is missing a valid address or subject."""
    try:
        SendEmailRequest(recipient=recipient, subject=subject, content=content)
    except Exception:
        raise BadRequestException("Invalid email address or missing required fields")


@router.post("/send", response_model=SendEmailResponse)
async def send_email_endpoint(
    recipient: str = Form(...),
    subject: str = Form(..., min_length=1),
    content: str = Form(...),
    attachment: UploadFile | None = File(None),
    _: User = Depends(get_current_admin),
) -> SendEmailResponse:
    """Send an email from an admin account and store the attempt."""
    _validate_email_request(recipient, subject, content)
    try:
        attachment_bytes = None
        attachment_filename = None
        if attachment and attachment.filename:
            attachment_bytes = await attachment.read()
            attachment_filename = attachment.filename
        await EmailService().send_email(
            recipient=recipient,
            subject=subject,
            content=content,
            attachment=attachment_bytes,
            attachment_filename=attachment_filename,
        )
        return SendEmailResponse(success=True, message="Email sent successfully")
    except AppException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
