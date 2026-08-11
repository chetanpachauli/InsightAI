from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from datetime import datetime
from app.core.database import Base
from sqlalchemy.orm import relationship

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False) # LOGIN, FILE_UPLOAD, FILE_CLEANED, WORKFLOW_STATUS_CHANGE, RULE_TRIGGERED
    details = Column(Text, nullable=True)
    
    # Track the exact ETL lineage step if applicable (e.g., 'RAW_UPLOAD', 'AI_CLEANED', 'MERGED_TO_PROD')
    lineage_step = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User")
