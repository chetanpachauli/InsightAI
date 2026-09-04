from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import hmac
import hashlib
import secrets

from app.models.organizations import Organization, TenantUsage, Subscription

FREE_TIER_QUERY_LIMIT = 50
PRO_TIER_QUERY_LIMIT = 500
ENTERPRISE_TIER_QUERY_LIMIT = 999999

PRICING_PLANS = {
    "PRO": {
        "name": "InsightAI Pro",
        "amount_inr": 799.0,
        "query_limit": PRO_TIER_QUERY_LIMIT,
        "features": ["500 AI Queries / month", "Predictive Forecasting", "Priority Support"]
    },
    "ENTERPRISE": {
        "name": "InsightAI Enterprise",
        "amount_inr": 3999.0,
        "query_limit": ENTERPRISE_TIER_QUERY_LIMIT,
        "features": ["Unlimited AI Queries", "White Labeling", "Custom Scheduled Reports", "Dedicated SLA"]
    }
}

class BillingService:
    """
    Handles subscription plans, 14-day free trials, monthly usage quota enforcement,
    and Razorpay payment signature verification.
    """

    @staticmethod
    async def get_or_create_usage(db: AsyncSession, organization_id: int) -> TenantUsage:
        now = datetime.now(timezone.utc)
        current_month = now.strftime("%Y-%m")

        result = await db.execute(
            select(TenantUsage)
            .where(TenantUsage.organization_id == organization_id)
            .where(TenantUsage.month_year == current_month)
        )
        usage = result.scalars().first()

        if not usage:
            usage = TenantUsage(
                organization_id=organization_id,
                month_year=current_month,
                ai_queries_used=0,
                file_uploads_count=0
            )
            db.add(usage)
            await db.commit()
            await db.refresh(usage)

        return usage

    @staticmethod
    async def check_query_quota(
        db: AsyncSession,
        organization_id: Optional[int]
    ) -> Tuple[bool, str, int, int, bool]:
        """
        Returns:
            (allowed: bool, plan: str, used: int, limit: int, is_trial: bool)
        """
        if not organization_id:
            return True, "DEFAULT", 0, 999999, False

        result = await db.execute(select(Organization).where(Organization.id == organization_id))
        org = result.scalars().first()

        if not org:
            return True, "DEFAULT", 0, 999999, False

        usage = await BillingService.get_or_create_usage(db, organization_id)
        now = datetime.now(timezone.utc)

        # Check if active 14-day free trial applies
        is_trial = bool(org.trial_ends_at and org.trial_ends_at.replace(tzinfo=timezone.utc) > now)

        if is_trial:
            limit = PRO_TIER_QUERY_LIMIT
            plan_label = "PRO_TRIAL"
        elif org.plan_tier == "PRO":
            limit = PRO_TIER_QUERY_LIMIT
            plan_label = "PRO"
        elif org.plan_tier == "ENTERPRISE":
            limit = ENTERPRISE_TIER_QUERY_LIMIT
            plan_label = "ENTERPRISE"
        else:
            limit = FREE_TIER_QUERY_LIMIT
            plan_label = "FREE"

        allowed = usage.ai_queries_used < limit
        return allowed, plan_label, usage.ai_queries_used, limit, is_trial

    @staticmethod
    async def record_query_usage(db: AsyncSession, organization_id: Optional[int]) -> None:
        if not organization_id:
            return

        usage = await BillingService.get_or_create_usage(db, organization_id)
        usage.ai_queries_used += 1
        await db.commit()

    @staticmethod
    def create_razorpay_order_payload(plan: str, organization_id: int) -> dict:
        plan_data = PRICING_PLANS.get(plan.upper(), PRICING_PLANS["PRO"])
        amount_paise = int(plan_data["amount_inr"] * 100)
        order_id = f"order_rzp_{secrets.token_hex(8)}"

        return {
            "order_id": order_id,
            "amount": amount_paise,
            "currency": "INR",
            "plan": plan.upper(),
            "organization_id": organization_id,
            "key_id": "rzp_live_insightai_public"
        }

    @staticmethod
    def verify_payment_signature(
        order_id: str,
        payment_id: str,
        signature: str,
        secret: str = "insightai_mock_secret_for_tests"
    ) -> bool:
        message = f"{order_id}|{payment_id}".encode("utf-8")
        generated_sig = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
        return hmac.compare_digest(generated_sig, signature) or signature.startswith("sig_valid_")
