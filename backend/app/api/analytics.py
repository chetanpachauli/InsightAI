"""
Analytics API Router - Part 2
Exposes:
  GET  /analytics/insights        - Smart insight pills
  GET  /analytics/forecast        - Predictive forecasting
  GET  /analytics/forecastable    - List of forecastable tables/columns
  GET  /analytics/export/excel    - Professional Excel report download
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, func as sqlfunc
import io
import re
import json
from datetime import datetime

from app.core.database import get_db
from app.core.rate_limit import limiter, GENERAL_RATE_LIMIT, AI_RATE_LIMIT
from app.api.deps import get_current_user
from app.models.users import User
from app.models.files import UploadedFile
from app.models.audit_logs import AuditLog
from app.models.rules import AlertRule
from app.services.insights_service import get_smart_insights
from app.services.forecasting_service import get_forecast, get_forecastable_columns
from app.services.export_service import generate_excel_report
from app.services.gemini_service import gemini_service

router = APIRouter(prefix="/analytics", tags=["Part 2 – Smart Analytics"])


# ─────────────────────────────────────────────────────────────────────────────
# GET /analytics/insights
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights")
@limiter.limit(GENERAL_RATE_LIMIT)
async def smart_insights(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Auto-detect business signals from all approved datasets.
    Returns insight pills with trend, value, color, and icon.
    """
    pills = await get_smart_insights(db)
    return {"insights": pills, "count": len(pills)}


# ─────────────────────────────────────────────────────────────────────────────
# GET /analytics/forecastable
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/forecastable")
@limiter.limit(GENERAL_RATE_LIMIT)
async def forecastable_columns(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return all approved tables and their numeric columns available for forecasting.
    Used by frontend to populate the Forecast page dropdowns.
    """
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.status == "COMPLETED")
        .where(UploadedFile.workflow_status == "APPROVED")
    )
    approved_files = result.scalars().all()

    options = []
    for file in approved_files:
        lineage = file.lineage_info or {}
        table_name = lineage.get("db_table")
        if not table_name:
            clean_slug = re.sub(r"[^a-z0-9]", "_", file.filename.lower().split(".")[0])
            table_name = f"data_{clean_slug}_v{file.version}"

        # Verify table exists
        try:
            exists = await db.execute(
                text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :t)"),
                {"t": table_name}
            )
            if not exists.scalar():
                continue
        except Exception:
            continue

        cols = await get_forecastable_columns(db, table_name)
        if cols:
            options.append({
                "table": table_name,
                "filename": file.filename,
                "version": file.version,
                "columns": cols,
            })

    return {"tables": options}


# ─────────────────────────────────────────────────────────────────────────────
# GET /analytics/forecast
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/forecast")
@limiter.limit(AI_RATE_LIMIT)
async def forecast_data(
    request: Request,
    response: Response,
    table_name: str = Query(..., description="Approved dataset table name"),
    column_name: str = Query(..., description="Numeric column to forecast"),
    horizon_days: int = Query(30, ge=7, le=90, description="Forecast horizon: 7-90 days"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a linear regression forecast for a numeric column.
    Returns historical data + forecast with confidence bands.
    """
    # Validate table is approved
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.status == "COMPLETED")
        .where(UploadedFile.workflow_status == "APPROVED")
    )
    approved_files = result.scalars().all()

    approved_tables = set()
    for file in approved_files:
        lineage = file.lineage_info or {}
        tname = lineage.get("db_table")
        if not tname:
            clean_slug = re.sub(r"[^a-z0-9]", "_", file.filename.lower().split(".")[0])
            tname = f"data_{clean_slug}_v{file.version}"
        approved_tables.add(tname)

    if table_name not in approved_tables:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Table is not an approved dataset.",
        )

    forecast_result = await get_forecast(db, table_name, column_name, horizon_days)

    if "error" in forecast_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=forecast_result["error"],
        )

    return forecast_result


# ─────────────────────────────────────────────────────────────────────────────
# GET /analytics/export/excel
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/export/excel")
@limiter.limit(GENERAL_RATE_LIMIT)
async def export_excel(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate and stream a professional multi-sheet Excel report.
    Includes: Executive KPIs, AI Insights, Smart Analytics, Audit Log.
    """
    # Fetch stats
    from sqlalchemy import func
    from app.models.audit_logs import AuditLog
    from app.models.rules import AlertRule

    files_count = await db.execute(
        __import__("sqlalchemy").select(__import__("sqlalchemy").func.count(UploadedFile.id))
    )

    # Re-use the query endpoint helpers for stats
    from sqlalchemy import func as sqlfunc
    from app.models.audit_logs import AuditLog
    from app.models.rules import AlertRule

    total_files_r = await db.execute(select(sqlfunc.count(UploadedFile.id)))
    total_approved_r = await db.execute(
        select(sqlfunc.count(UploadedFile.id)).where(UploadedFile.workflow_status == "APPROVED")
    )
    total_rules_r = await db.execute(
        select(sqlfunc.count(AlertRule.id)).where(AlertRule.is_active == True)
    )
    logs_r = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(20)
    )
    logs = logs_r.scalars().all()

    stats = {
        "total_files": total_files_r.scalar() or 0,
        "total_approved": total_approved_r.scalar() or 0,
        "total_rules": total_rules_r.scalar() or 0,
        "recent_logs": [
            {
                "timestamp": str(log.created_at),
                "action": log.action,
                "details": log.details or "",
            }
            for log in logs
        ],
    }

    # Fetch AI insights (from Gemini, cached)
    insights = None
    try:
        from app.services.gemini_service import gemini_service
        from app.models.files import UploadedFile as UF
        import json as _json
        files_r2 = await db.execute(
            select(UF).where(UF.status == "COMPLETED").where(UF.workflow_status == "APPROVED")
        )
        approved = files_r2.scalars().all()
        if approved:
            summary_metrics = []
            for f in approved:
                lineage = f.lineage_info or {}
                metrics = lineage.get("metrics", {})
                summary_metrics.append({
                    "filename": f.filename,
                    "version": f.version,
                    "rows": metrics.get("total_rows", 0),
                    "columns": metrics.get("total_columns", 0),
                })
            ai = gemini_service.generate_insights(_json.dumps(summary_metrics))
            insights = {"key_findings": ai.key_findings, "recommendations": ai.recommendations}
    except Exception:
        pass

    # Fetch smart pills
    smart_pills = None
    try:
        smart_pills = await get_smart_insights(db)
    except Exception:
        pass

    # Generate Excel bytes
    excel_bytes = generate_excel_report(
        stats=stats,
        insights=insights,
        smart_pills=smart_pills,
        user_email=current_user.email,
        user_role=current_user.role,
    )

    filename = f"InsightAI_Report_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
