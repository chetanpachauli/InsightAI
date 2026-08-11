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
    """Toggle a rule between Active and Inactive states."""
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
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
    """Delete a rule entirely from the system."""
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
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
