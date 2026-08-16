from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, func
from app.core.database import get_db
from app.core.rate_limit import limiter, AI_RATE_LIMIT, GENERAL_RATE_LIMIT
from app.api.deps import get_current_user
from app.models.users import User
from app.models.files import UploadedFile
from app.models.audit_logs import AuditLog
from app.models.rules import AlertRule
from app.services.gemini_service import gemini_service
from app.core.config import settings
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import re
from datetime import datetime

router = APIRouter(prefix="/query", tags=["AI Analytics & Querying"])

class ChatQueryRequest(BaseModel):
    question: str

class RawTableRequest(BaseModel):
    table_name: str

@router.post("/chat")
@limiter.limit(AI_RATE_LIMIT)
async def chat_with_data(
    request: Request,
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
        
        # Fallback for older records where ETL lineage wasn't persisted:
        # derive the dynamic table name from the filename + version convention.
        if not table_name:
            clean_slug = re.sub(r"[^a-z0-9]", "_", file.filename.lower().split(".")[0])
            table_name = f"data_{clean_slug}_v{file.version}"
        
        if not columns:
            try:
                cols_result = await db.execute(text(
                    "SELECT column_name, data_type FROM information_schema.columns "
                    "WHERE table_name = :t ORDER BY ordinal_position"
                ), {"t": table_name})
                columns = [
                    {"cleaned": c["column_name"], "type": c["data_type"]}
                    for c in cols_result.mappings()
                    if not c["column_name"].startswith("_")
                ]
            except Exception:
                columns = []
            
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
    if not gemini_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gemini API key is not configured. Add GEMINI_API_KEY to your .env file to enable AI chat queries."
        )

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

    # Reject statement chaining: a single read-only SELECT should never contain ';'
    sql_query = sql_query.strip()
    if sql_query.endswith(";"):
        sql_query = sql_query[:-1].strip()
    if ";" in sql_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security alert: multi-statement SQL is not permitted."
        )
    query_upper = sql_query.upper()
         
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

@router.post("/raw-data")
@limiter.limit(GENERAL_RATE_LIMIT)
async def get_raw_table_data(
    request: Request,
    req: RawTableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch raw rows from an approved & completed data table without involving
    Gemini. Used by the Pivot Builder for fast, deterministic table reads.
    """
    # 1. Validate table identifier format (SQL injection guard)
    if not re.match(r'^[a-zA-Z0-9_]+$', req.table_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid table name format. Only alphanumeric characters and underscores are allowed."
        )

    # 2. Only allow tables that are COMPLETED and APPROVED in the registry
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.status == "COMPLETED")
        .where(UploadedFile.workflow_status == "APPROVED")
    )
    approved_files = result.scalars().all()

    approved_table_names = set()
    for file in approved_files:
        lineage = file.lineage_info or {}
        table_name = lineage.get("db_table")
        if not table_name:
            clean_slug = re.sub(r"[^a-z0-9]", "_", file.filename.lower().split(".")[0])
            table_name = f"data_{clean_slug}_v{file.version}"
        approved_table_names.add(table_name)

    if req.table_name not in approved_table_names:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Table is not an approved dataset."
        )

    # 3. Verify the physical table exists before reading
    try:
        table_check = await db.execute(text(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :tbl)"
        ), {"tbl": req.table_name})
        if not table_check.scalar():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Table '{req.table_name}' does not exist."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verifying table existence: {str(e)}"
        )

    # 4. Fetch rows (capped to protect the browser from very large tables)
    try:
        query_result = await db.execute(text(
            f'SELECT * FROM "{req.table_name}" ORDER BY _row_id LIMIT 5000'
        ))
        rows = [dict(row) for row in query_result.mappings()]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read table '{req.table_name}': {str(e)}"
        )

    columns = [key for key in (rows[0].keys() if rows else []) if not key.startswith("_")]

    return {
        "table_name": req.table_name,
        "columns": columns,
        "data": rows,
        "total_rows": len(rows)
    }

@router.get("/insights")
@limiter.limit(AI_RATE_LIMIT)
async def get_executive_insights(
    request: Request,
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
        
        # Fallback for older records where ETL lineage wasn't persisted:
        # derive the dynamic table name and read live row/column counts.
        if not table_name:
            clean_slug = re.sub(r"[^a-z0-9]", "_", file.filename.lower().split(".")[0])
            table_name = f"data_{clean_slug}_v{file.version}"
        
        rows_count = metrics.get("total_rows", 0)
        cols_count = metrics.get("total_columns", 0)
        if not metrics:
            try:
                cols_result = await db.execute(text(
                    "SELECT COUNT(*) AS total FROM information_schema.columns "
                    "WHERE table_name = :t AND column_name NOT LIKE '\\_%'"
                ), {"t": table_name})
                cols_count = cols_result.scalar() or 0
                
                row_result = await db.execute(text(
                    f"SELECT COUNT(*) FROM {table_name}"
                ))
                rows_count = row_result.scalar() or 0
            except Exception:
                pass
        
        summary_metrics.append({
            "filename": file.filename,
            "version": file.version,
            "table_name": table_name,
            "rows": rows_count,
            "columns": cols_count,
            "duplicate_rows": metrics.get("duplicate_rows_detected", 0),
            "missing_cells": metrics.get("missing_cells_detected", 0)
        })

    # Cache expensive Gemini insight generation. Key is derived from the
    # underlying data fingerprint so fresh uploads naturally invalidate it.
    from app.core.cache import cache_get_json, cache_set_json, cache_key
    data_fingerprint = ",".join(
        f"{m['filename']}:{m['version']}:{m['rows']}:{m['columns']}" for m in summary_metrics
    )
    cache_id = cache_key("insights", current_user.id, data_fingerprint)
    cached = await cache_get_json(cache_id)
    if cached is not None:
        return cached

    # Call Gemini to write insights
    metrics_json_str = json.dumps(summary_metrics, indent=2)
    ai_insights = gemini_service.generate_insights(metrics_json_str)

    insights_payload = {
        "key_findings": ai_insights.key_findings,
        "recommendations": ai_insights.recommendations,
        "cached": False,
    }
    await cache_set_json(cache_id, insights_payload, settings.CACHE_TTL_INSIGHTS)
    return insights_payload

@router.get("/stats")
async def get_dashboard_stats(
    limit: int = 5,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve high-level counters and the latest audit trail entries for the dashboard."""
    # Keep the limit sane
    limit = max(1, min(limit, 100))

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
    
    # Fetch recent audit logs
    logs_result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
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

@router.get("/export/summary")
async def get_export_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dedicated enterprise endpoint for compiling complete system status,
    statistical metrics, anomaly lineage logs, and AI executive summaries.
    """
    # 1. Fetch file records
    files_result = await db.execute(
        select(UploadedFile).where(UploadedFile.status == "COMPLETED")
    )
    all_files = files_result.scalars().all()
    
    table_summaries = []
    total_anomalies_count = 0
    for f in all_files:
        lineage = f.lineage_info or {}
        metrics = lineage.get("metrics", {})
        anomalies = metrics.get("statistical_anomalies", [])
        total_anomalies_count += sum(a.get("outlier_count", 0) for a in anomalies if isinstance(a, dict))
        table_summaries.append({
            "filename": f.filename,
            "version": f.version,
            "status": f.workflow_status,
            "total_rows": metrics.get("total_rows", 0),
            "total_columns": metrics.get("total_columns", 0),
            "duplicate_rows": metrics.get("duplicate_rows_detected", 0),
            "missing_cells": metrics.get("missing_cells_detected", 0),
            "anomalies_detected": anomalies
        })

    # 2. Fetch rules count
    rules_result = await db.execute(select(func.count(AlertRule.id)).where(AlertRule.is_active == True))
    total_active_rules = rules_result.scalar() or 0

    return {
        "report_title": "InsightAI Enterprise Intelligence Report",
        "generated_by": current_user.email,
        "role": current_user.role,
        "generated_at": datetime.utcnow().isoformat(),
        "summary": {
            "total_files": len(all_files),
            "approved_files": len([f for f in all_files if f.workflow_status == "APPROVED"]),
            "active_alert_rules": total_active_rules,
            "total_statistical_anomalies": total_anomalies_count
        },
        "datasets": table_summaries
    }


