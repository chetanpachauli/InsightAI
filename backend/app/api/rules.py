from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.users import User
from app.models.rules import AlertRule
from app.models.audit_logs import AuditLog
from app.api.schemas import RuleCreate, RuleOut
from typing import List

router = APIRouter(prefix="/rules", tags=["Alert & Rule Engine"])

@router.post("", response_model=RuleOut, status_code=status.HTTP_201_CREATED)
async def create_rule(
    rule_in: RuleCreate,
    current_user: User = Depends(RoleChecker(allowed_roles=["Admin", "Manager", "MIS"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new alerting automation rule.
    Restricted to Admin, Manager, and MIS.
    """
    db_rule = AlertRule(
        name=rule_in.name,
        rule_type=rule_in.rule_type,
        condition_col=rule_in.condition_col,
        operator=rule_in.operator,
        value=rule_in.value,
        action_type=rule_in.action_type,
        recipient=rule_in.recipient,
        webhook_url=rule_in.webhook_url,
        is_active=True,
        owner_id=current_user.id
    )
    db.add(db_rule)
    await db.flush() # Flush to get id
    
    # Audit trail
    audit = AuditLog(
        user_id=current_user.id,
        action="RULE_CREATE",
        details=f"Created rule: {rule_in.name} (IF {rule_in.condition_col} {rule_in.operator} {rule_in.value} THEN {rule_in.action_type})",
        lineage_step="RULE_ENGINE_CONFIG"
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(db_rule)
    return db_rule

@router.get("", response_model=List[RuleOut])
async def list_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all active and inactive rules in the system."""
    result = await db.execute(select(AlertRule).order_by(AlertRule.created_at.desc()))
    return result.scalars().all()

@router.post("/{rule_id}/toggle", response_model=RuleOut)
async def toggle_rule(
    rule_id: int,
    current_user: User = Depends(RoleChecker(allowed_roles=["Admin", "Manager", "MIS"])),
    db: AsyncSession = Depends(get_db)
):
    """Toggle a rule between Active and Inactive states. Owners and Admins only."""
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Ownership enforcement: only the rule owner or an Admin may modify it
    if current_user.role != "Admin" and db_rule.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only modify alert rules that you created."
        )
        
    db_rule.is_active = not db_rule.is_active
    
    # Audit trail
    audit = AuditLog(
        user_id=current_user.id,
        action="RULE_TOGGLE",
        details=f"Toggled rule ID {rule_id} status to active={db_rule.is_active}",
        lineage_step="RULE_ENGINE_CONFIG"
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(db_rule)
    return db_rule

@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: int,
    current_user: User = Depends(RoleChecker(allowed_roles=["Admin", "Manager", "MIS"])),
    db: AsyncSession = Depends(get_db)
):
    """Delete a rule entirely from the system. Owners and Admins only."""
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Ownership enforcement: only the rule owner or an Admin may delete it
    if current_user.role != "Admin" and db_rule.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete alert rules that you created."
        )
        
    # Audit trail
    audit = AuditLog(
        user_id=current_user.id,
        action="RULE_DELETE",
        details=f"Deleted rule: {db_rule.name} (ID: {rule_id})",
        lineage_step="RULE_ENGINE_CONFIG"
    )
    db.add(audit)
    
    await db.delete(db_rule)
    await db.commit()
    return None

@router.post("/test-all", status_code=status.HTTP_200_OK)
async def test_all_rules(
    current_user: User = Depends(RoleChecker(allowed_roles=["Admin", "Manager", "MIS"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually trigger all active rules against all approved data tables.
    This allows testing rules without waiting for new file uploads.
    """
    from app.models.files import UploadedFile
    from app.services.etl import ETLService
    from sqlalchemy import text
    
    # Get all approved files
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.workflow_status == "APPROVED",
            UploadedFile.status == "COMPLETED"
        )
    )
    approved_files = result.scalars().all()
    
    if not approved_files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No approved data tables found. Please upload and approve files first."
        )
    
    etl_service = ETLService()
    tested_tables = []
    triggered_count = 0
    
    for file_record in approved_files:
        lineage = file_record.lineage_info or {}
        table_name = lineage.get("db_table")
        
        if not table_name:
            continue
            
        # Verify table exists
        try:
            table_check = await db.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :tbl)"
            ), {"tbl": table_name})
            exists = table_check.scalar()
            
            if exists:
                # Run rules check on this table
                await etl_service.check_rules_on_table(table_name, db)
                tested_tables.append(table_name)
        except Exception as e:
            print(f"Error testing rules on table {table_name}: {str(e)}")
            continue
    
    # Count how many rules were checked
    rules_result = await db.execute(select(AlertRule).where(AlertRule.is_active == True))
    active_rules_count = len(rules_result.scalars().all())
    
    # Audit trail
    audit = AuditLog(
        user_id=current_user.id,
        action="RULES_TEST",
        details=f"Manually triggered {active_rules_count} active rules across {len(tested_tables)} approved tables: {', '.join(tested_tables) if tested_tables else 'none'}",
        lineage_step="RULE_ENGINE_TEST"
    )
    db.add(audit)
    await db.commit()
    
    return {
        "status": "SUCCESS",
        "message": f"Tested {active_rules_count} active rules against {len(tested_tables)} approved tables",
        "tables_tested": tested_tables,
        "active_rules_count": active_rules_count
    }
