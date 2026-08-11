from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.users import User
from app.models.files import UploadedFile
from app.models.audit_logs import AuditLog
from app.services.gemini_service import gemini_service
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json

router = APIRouter(prefix="/query", tags=["AI Analytics & Querying"])

class ChatQueryRequest(BaseModel):
    question: str

@router.post("/chat")
async def chat_with_data(
    query_in: ChatQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Natural Language Chat with Database:
    1. Retrieve all COMPLETED and APPROVED files.
    2. Extract their table schemas from lineage data.
    3. Ask Gemini to write a SQL query.
    4. Execute SQL query and return results with chart suggestions.
    """
    # 1. Fetch approved and completed uploaded files
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.status == "COMPLETED")
        .where(UploadedFile.workflow_status == "APPROVED")
    )
    approved_files = result.scalars().all()
    
    if not approved_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files have been approved yet. Please upload files and get Manager/CEO approval first."
        )

    # 2. Build Schema Description for Gemini context
    schema_descriptions = []
    for file in approved_files:
        lineage = file.lineage_info or {}
        table_name = lineage.get("db_table")
        columns = lineage.get("columns_mapped", [])
        
        if not table_name:
            continue
            
        col_desc = []
        for col in columns:
            col_desc.append(f"{col['cleaned']} ({col['type']})")
            
        schema_descriptions.append(
            f"Table Name: {table_name}\n"
            f"Description: Contains data uploaded from original file '{file.filename}' (Version {file.version})\n"
            f"Columns: {', '.join(col_desc)}"
        )
        
    full_schema_context = "\n\n".join(schema_descriptions)

    # 3. Call Gemini service to write SQL
    ai_response = gemini_service.generate_sql_from_nl(
        user_question=query_in.question,
        schema_description=full_schema_context
    )

    sql_query = ai_response.sql_query
    explanation = ai_response.explanation

    # 4. Execute the generated SQL query in PostgreSQL
    # Basic SQL injection check: ensure it starts with SELECT and doesn't contain destructive keywords
    query_upper = sql_query.upper().strip()
    if not query_upper.startswith("SELECT"):
         raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail="For security, only SELECT query executions are permitted."
         )
         
    destructive_keywords = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE", "CREATE"]
    for keyword in destructive_keywords:
        # Check for whole word match to avoid false positives
        if re.search(r'\b' + keyword + r'\b', query_upper):
             raise HTTPException(
                 status_code=status.HTTP_400_BAD_REQUEST,
                 detail=f"Security alert: Blocked execution of query containing '{keyword}' keyword."
             )

    try:
        query_result = await db.execute(text(sql_query))
        
        # Parse output records to list of dicts
        # SQLAlchemy returns RowMapping objects when accessing .mappings()
        rows = [dict(row) for row in query_result.mappings()]
        
        # Write to audit logs
        audit = AuditLog(
            user_id=current_user.id,
            action="AI_SQL_QUERY",
            details=f"NL Query: '{query_in.question}' -> Executed generated SQL: '{sql_query}'",
            lineage_step="AI_CHAT"
        )
        db.add(audit)
        await db.commit()
        
        return {
            "question": query_in.question,
            "generated_sql": sql_query,
            "explanation": explanation,
            "data": rows,
            "chart_config": {
                "chart_type": ai_response.chart_type,
                "x_axis": ai_response.x_axis_column,
                "y_axis": ai_response.y_axis_column
            }
        }
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing AI-generated SQL query: {str(e)}. (Generated SQL was: {sql_query})"
        )

@router.get("/insights")
async def get_executive_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Compile a high-level summary of all approved data tables and ask Gemini to write
    key findings and business recommendations.
    """
    # 1. Fetch approved and completed uploaded files
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.status == "COMPLETED")
        .where(UploadedFile.workflow_status == "APPROVED")
    )
    approved_files = result.scalars().all()
    
    if not approved_files:
        return {
            "key_findings": ["No approved data sheets found in the system yet."],
            "recommendations": ["Upload and approve sales/inventory sheets to generate AI insights."]
        }

    # 2. Extract metrics summary from all tables to pass to Gemini
    summary_metrics = []
    for file in approved_files:
        lineage = file.lineage_info or {}
        metrics = lineage.get("metrics", {})
        table_name = lineage.get("db_table")
        
        summary_metrics.append({
            "filename": file.filename,
            "version": file.version,
            "table_name": table_name,
            "rows": metrics.get("total_rows", 0),
            "columns": metrics.get("total_columns", 0),
            "duplicate_rows": metrics.get("duplicate_rows_detected", 0),
            "missing_cells": metrics.get("missing_cells_detected", 0)
        })

    # Call Gemini to write insights
    metrics_json_str = json.dumps(summary_metrics, indent=2)
    ai_insights = gemini_service.generate_insights(metrics_json_str)
    
    return ai_insights

from sqlalchemy import func
from app.models.rules import AlertRule

@router.get("/stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve high-level counters and the latest audit trail entries for the dashboard."""
    # Count total files
    files_count = await db.execute(select(func.count(UploadedFile.id)))
    total_files = files_count.scalar() or 0
    
    # Count approved files
    approved_files_count = await db.execute(
        select(func.count(UploadedFile.id))
        .where(UploadedFile.workflow_status == "APPROVED")
    )
    total_approved = approved_files_count.scalar() or 0
    
    # Count active alert rules
    rules_count = await db.execute(
        select(func.count(AlertRule.id))
        .where(AlertRule.is_active == True)
    )
    total_rules = rules_count.scalar() or 0
    
    # Fetch recent 5 audit logs
    logs_result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(5)
    )
    recent_logs = logs_result.scalars().all()
    
    return {
        "total_files": total_files,
        "total_approved": total_approved,
        "total_rules": total_rules,
        "recent_logs": [
            {
                "id": log.id,
                "action": log.action,
                "details": log.details,
                "timestamp": log.created_at
            }
            for log in recent_logs
        ]
    }

# Import regular expression library for security filtering
import re

