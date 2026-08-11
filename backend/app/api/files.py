from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db, SessionLocal
from app.api.deps import get_current_user, RoleChecker
from app.models.users import User
from app.models.files import UploadedFile
from app.models.audit_logs import AuditLog
from app.api.schemas import FileOut
from app.core.config import settings
import os
import shutil
from datetime import datetime
from typing import List

router = APIRouter(prefix="/files", tags=["File & Upload Management"])

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

async def run_etl_task(file_id: int):
    """Background task to run Polars ETL pipeline using a dedicated session."""
    from app.services.etl import etl_service
    async with SessionLocal() as session:
        await etl_service.process_file_etl(file_id, session)

@router.post("/upload", response_model=FileOut, status_code=status.HTTP_201_CREATED)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(RoleChecker(allowed_roles=["Admin", "MIS"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload an Excel or CSV file. Auto-increments file version if duplicate filename exists.
    Restricted to Admin and MIS roles.
    """
    # 1. Validate file extension
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only .csv, .xlsx, and .xls are supported."
        )

    # 2. Check for existing file to handle Version Control (v1, v2, v3...)
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.filename == file.filename)
        .order_by(UploadedFile.version.desc())
    )
    latest_file = result.scalars().first()
    
    new_version = 1
    if latest_file:
        new_version = latest_file.version + 1

    # 3. Create target path and save file to local folder
    # Format target name: Filename_v{version}{extension}
    base_name, ext = os.path.splitext(file.filename)
    saved_filename = f"{base_name}_v{new_version}{ext}"
    target_path = os.path.join(settings.UPLOAD_DIR, saved_filename)
    
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )

    # 4. Data Lineage log entry
    lineage_info = {
        "action": "UPLOAD",
        "timestamp": datetime.utcnow().isoformat(),
        "uploaded_by": current_user.email,
        "original_name": file.filename,
        "saved_as": saved_filename,
        "version": new_version
    }

    # 5. Save database record
    db_file = UploadedFile(
        filename=file.filename,
        version=new_version,
        file_path=target_path,
        status="PENDING", # Triggers backend cleaning pipeline
        workflow_status="DRAFT", # Starts as draft for approval workflow
        owner_id=current_user.id,
        lineage_info=lineage_info
    )
    
    db.add(db_file)
    await db.flush() # Flush to get db_file.id

    # 6. Write to Audit Logs (For audit trail & lineage)
    audit = AuditLog(
        user_id=current_user.id,
        action="FILE_UPLOAD",
        details=f"Uploaded {file.filename} version {new_version} as {saved_filename}",
        lineage_step="RAW_UPLOAD"
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(db_file)
    
    # Trigger background ETL task (converts Excel/CSV to PostgreSQL tables)
    background_tasks.add_task(run_etl_task, db_file.id)

    return db_file

@router.get("", response_model=List[FileOut])
async def list_files(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all uploaded files. Accessible by all authenticated users."""
    result = await db.execute(select(UploadedFile).order_by(UploadedFile.created_at.desc()))
    return result.scalars().all()

@router.post("/{file_id}/approve", response_model=FileOut)
async def approve_file(
    file_id: int,
    current_user: User = Depends(RoleChecker(allowed_roles=["Admin", "Manager", "CEO"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Transition approval state of files:
    - MIS uploads (DRAFT)
    - Manager reviews (DRAFT -> REVIEWED)
    - CEO approves (REVIEWED -> APPROVED)
    """
    result = await db.execute(select(UploadedFile).where(UploadedFile.id == file_id))
    db_file = result.scalars().first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    old_status = db_file.workflow_status
    new_status = old_status

    if current_user.role == "Manager":
        if old_status == "DRAFT":
            new_status = "REVIEWED"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Manager can only review files in DRAFT status."
            )
    elif current_user.role in ["Admin", "CEO"]:
        if old_status in ["DRAFT", "REVIEWED"]:
            new_status = "APPROVED"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File already in {old_status} status."
            )

    # Update workflow state
    db_file.workflow_status = new_status
    db_file.approved_by_id = current_user.id
    
    # Update lineage info history list
    lineage = db_file.lineage_info or {}
    history = lineage.get("approval_history", [])
    history.append({
        "from_state": old_status,
        "to_state": new_status,
        "action_by": current_user.email,
        "timestamp": datetime.utcnow().isoformat()
    })
    lineage["approval_history"] = history
    db_file.lineage_info = lineage
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="WORKFLOW_APPROVE",
        details=f"File ID {file_id} state changed from {old_status} to {new_status}",
        lineage_step=f"WORKFLOW_{new_status}"
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(db_file)
    return db_file

@router.get("/{file_id}/lineage")
async def get_lineage(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve full audit lineage steps for a specific file."""
    result = await db.execute(select(UploadedFile).where(UploadedFile.id == file_id))
    db_file = result.scalars().first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    # Query all audits related to this file ID or file operations
    # Simple search details match (can be scaled)
    audit_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.details.like(f"%File ID {file_id}%") | AuditLog.details.like(f"%Uploaded {db_file.filename}%"))
        .order_by(AuditLog.created_at.asc())
    )
    audits = audit_result.scalars().all()
    
    return {
        "file_details": {
            "id": db_file.id,
            "filename": db_file.filename,
            "version": db_file.version,
            "current_status": db_file.status,
            "workflow": db_file.workflow_status
        },
        "raw_lineage": db_file.lineage_info,
        "audit_trail": [
            {
                "id": a.id,
                "action": a.action,
                "details": a.details,
                "step": a.lineage_step,
                "timestamp": a.created_at
            }
            for a in audits
        ]
    }
