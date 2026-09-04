from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.core.database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    plan_tier = Column(String(20), default="FREE", nullable=False) # FREE, PRO, ENTERPRISE
    trial_ends_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc) + timedelta(days=14),
        nullable=True
    )
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    users = relationship("User", back_populates="organization", foreign_keys="User.organization_id")
    usage_records = relationship("TenantUsage", back_populates="organization", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="organization", cascade="all, delete-orphan")

class TenantUsage(Base):
    __tablename__ = "tenant_usage"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    month_year = Column(String(7), nullable=False, index=True) # e.g. "2026-09"
    ai_queries_used = Column(Integer, default=0, nullable=False)
    file_uploads_count = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="usage_records")

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    razorpay_order_id = Column(String(100), nullable=True)
    razorpay_payment_id = Column(String(100), nullable=True)
    plan = Column(String(20), nullable=False) # PRO, ENTERPRISE
    amount = Column(Float, nullable=False)
    currency = Column(String(5), default="INR", nullable=False)
    status = Column(String(20), default="ACTIVE", nullable=False) # ACTIVE, EXPIRED, CANCELLED
    starts_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=False)

    organization = relationship("Organization", back_populates="subscriptions")
