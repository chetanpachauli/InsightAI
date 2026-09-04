from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.users import User
from app.models.organizations import Organization, Subscription
from app.services.billing_service import BillingService, PRICING_PLANS
from app.services.two_factor import TwoFactorService
from app.core.rate_limit import limiter, GENERAL_RATE_LIMIT

router = APIRouter(prefix="/billing", tags=["Billing & Enterprise Tenancy"])

class CreateOrderRequest(BaseModel):
    plan: str # PRO, ENTERPRISE

class VerifyPaymentRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str
    plan: str

class Verify2FARequest(BaseModel):
    secret: str
    code: str

class Disable2FARequest(BaseModel):
    code: str

@router.get("/usage")
@limiter.limit(GENERAL_RATE_LIMIT)
async def get_tenant_usage(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve the current organization's usage quotas, active tier, and trial status."""
    allowed, plan, used, limit, is_trial = await BillingService.check_query_quota(
        db, current_user.organization_id
    )

    trial_date = None
    org_name = "Default Organization"
    if current_user.organization_id:
        result = await db.execute(
            select(Organization).where(Organization.id == current_user.organization_id)
        )
        org = result.scalars().first()
        if org:
            org_name = org.name
            if org.trial_ends_at:
                trial_date = org.trial_ends_at.isoformat()

    return {
        "organization_name": org_name,
        "plan_tier": plan,
        "is_trial": is_trial,
        "trial_ends_at": trial_date,
        "ai_queries_used": used,
        "query_limit": limit,
        "quota_exhausted": not allowed,
        "two_factor_enabled": current_user.two_factor_enabled
    }

@router.post("/order")
@limiter.limit(GENERAL_RATE_LIMIT)
async def create_checkout_order(
    request: Request,
    response: Response,
    order_req: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a Razorpay order payload for upgrading to Pro or Enterprise tier."""
    org_id = current_user.organization_id or 1
    order_payload = BillingService.create_razorpay_order_payload(order_req.plan, org_id)
    return order_payload

@router.post("/verify")
@limiter.limit(GENERAL_RATE_LIMIT)
async def verify_payment_and_upgrade(
    request: Request,
    response: Response,
    verif_req: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify payment signature and activate the upgraded subscription."""
    is_valid = BillingService.verify_payment_signature(
        verif_req.order_id,
        verif_req.payment_id,
        verif_req.signature
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment signature. Verification failed."
        )

    org_id = current_user.organization_id or 1
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalars().first()

    if org:
        org.plan_tier = verif_req.plan.upper()

    now = datetime.now(timezone.utc)
    sub = Subscription(
        organization_id=org_id,
        razorpay_order_id=verif_req.order_id,
        razorpay_payment_id=verif_req.payment_id,
        plan=verif_req.plan.upper(),
        amount=PRICING_PLANS.get(verif_req.plan.upper(), {}).get("amount_inr", 799.0),
        currency="INR",
        status="ACTIVE",
        starts_at=now,
        expires_at=now + timedelta(days=30)
    )
    db.add(sub)
    await db.commit()

    return {
        "status": "success",
        "message": f"Successfully upgraded to {verif_req.plan.upper()} tier!",
        "plan": verif_req.plan.upper()
    }

@router.post("/two-factor/setup")
@limiter.limit(GENERAL_RATE_LIMIT)
async def setup_two_factor(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
):
    """Generate a secret key and otpauth URI for Google Authenticator setup."""
    secret = TwoFactorService.generate_secret()
    uri = TwoFactorService.get_otpauth_uri(secret, current_user.email)
    return {
        "secret": secret,
        "otpauth_uri": uri
    }

@router.post("/two-factor/verify")
@limiter.limit(GENERAL_RATE_LIMIT)
async def verify_and_enable_two_factor(
    request: Request,
    response: Response,
    req: Verify2FARequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify code and enable optional 2FA on the user's account."""
    is_valid = TwoFactorService.verify_code(req.secret, req.code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 6-digit authentication code. Please try again."
        )

    current_user.two_factor_enabled = True
    current_user.two_factor_secret = req.secret
    await db.commit()

    return {
        "status": "success",
        "message": "Two-Factor Authentication is now enabled on your account."
    }

@router.post("/two-factor/disable")
@limiter.limit(GENERAL_RATE_LIMIT)
async def disable_two_factor(
    request: Request,
    response: Response,
    req: Disable2FARequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Disable 2FA on user account."""
    if not current_user.two_factor_enabled:
        return {"status": "success", "message": "2FA is already disabled."}

    is_valid = TwoFactorService.verify_code(current_user.two_factor_secret, req.code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid authentication code."
        )

    current_user.two_factor_enabled = False
    current_user.two_factor_secret = None
    await db.commit()

    return {
        "status": "success",
        "message": "Two-Factor Authentication has been disabled."
    }
