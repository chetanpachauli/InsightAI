from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base
from sqlalchemy.orm import relationship

class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    rule_type = Column(String, default="CUSTOM", nullable=False) # e.g. SALES, INVENTORY, FINANCE
    
    condition_col = Column(String, nullable=False) # Column to check (e.g. 'amount', 'stock')
    operator = Column(String, nullable=False)      # e.g. '<', '>', '==', '<='
    value = Column(String, nullable=False)         # Threshold value
    
    action_type = Column(String, default="ALERT", nullable=False) # EMAIL, ALERT, WEBHOOK
    recipient = Column(String, nullable=True)      # Email address or username to notify
    webhook_url = Column(String, nullable=True)    # Slack/Discord Webhook URL
    is_active = Column(Boolean, default=True, nullable=False)
    
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    owner = relationship("User")
