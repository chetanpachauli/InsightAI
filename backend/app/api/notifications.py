from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.users import User
from app.models.audit_logs import AuditLog
from app.services.notification_service import notification_service
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/notifications", tags=["Manual Notification Center"])

class ManualNotificationRequest(BaseModel):
    recipient: str
    channel: str # "EMAIL" | "WHATSAPP"
    subject: Optional[str] = "InsightAI System Update"
    message: str

@router.post("/send", status_code=status.HTTP_200_OK)
async def send_manual_notification(
    req_in: ManualNotificationRequest,
    current_user: User = Depends(RoleChecker(allowed_roles=["Admin", "MIS", "Manager"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually dispatch a notification via Email or WhatsApp.
    Authorized Admin, MIS, or Managers can trigger this.
    """
    if req_in.channel not in ["EMAIL", "WHATSAPP"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid notification channel. Choose EMAIL or WHATSAPP."
        )

    try:
        success = False
        if req_in.channel == "EMAIL":
            success = notification_service.send_generic_email(
                recipient=req_in.recipient,
                subject=req_in.subject,
                message=req_in.message
            )
        elif req_in.channel == "WHATSAPP":
            success = notification_service.send_whatsapp_notification(
                recipient=req_in.recipient,
                message=req_in.message
            )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to deliver notification over {req_in.channel}."
            )

        # Audit log entry for tracking
        audit = AuditLog(
            user_id=current_user.id,
            action="MANUAL_NOTIFICATION",
            details=f"Manually sent {req_in.channel} to {req_in.recipient}. Msg length: {len(req_in.message)} chars.",
            lineage_step="NOTIFICATION_HUB"
        )
        db.add(audit)
        await db.commit()

        return {"status": "SUCCESS", "message": f"Notification successfully queued over {req_in.channel}."}

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error dispatching notification: {str(e)}"
        )
