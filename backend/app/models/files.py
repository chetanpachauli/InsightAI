from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from datetime import datetime
from app.core.database import Base
from sqlalchemy.orm import relationship

class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    version = Column(Integer, default=1, nullable=False) # Excel Version Control (v1, v2, v3)
    file_path = Column(String, nullable=False)
    
    # Task Status: PENDING -> PROCESSING -> COMPLETED -> FAILED
    status = Column(String, default="PENDING", nullable=False)
    
    # Enterprise Approval Workflow: DRAFT (MIS) -> REVIEWED (Manager) -> APPROVED (CEO)
    workflow_status = Column(String, default="DRAFT", nullable=False)
    
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Store source file metadata history for Data Lineage tracing
    lineage_info = Column(JSON, nullable=True) 
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    approver = relationship("User", foreign_keys=[approved_by_id])
