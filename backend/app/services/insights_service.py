"""
Smart Insights Service - Part 2 Feature
Automatically generates highlight pills and trend analysis from uploaded data.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from app.models.files import UploadedFile
from typing import List, Dict, Any
import re
import json


class InsightPill:
    """Represents a single insight pill shown on dashboard."""
    def __init__(self, label: str, value: str, trend: str, color: str, icon: str):
        self.label = label
        self.value = value
        self.trend = trend   # 'up', 'down', 'neutral', 'warning'
        self.color = color
        self.icon = icon

    def to_dict(self) -> Dict:
        return {
            "label": self.label,
            "value": self.value,
            "trend": self.trend,
            "color": self.color,
            "icon": self.icon,
        }


async def get_smart_insights(db: AsyncSession) -> List[Dict]:
    """
    Analyze all APPROVED + COMPLETED tables and generate smart insight pills.
    Steps:
      1. Fetch approved files with lineage
      2. Per table: detect numeric columns, compute aggregates
      3. Build insight pills from the aggregates
    """
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.status == "COMPLETED")
        .where(UploadedFile.workflow_status == "APPROVED")
    )
    approved_files = result.scalars().all()

    if not approved_files:
        return []

    pills: List[Dict] = []

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

        # Get numeric columns
        try:
            cols_res = await db.execute(
                text("""
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_name = :t
                      AND data_type IN ('integer','bigint','numeric','double precision','real','smallint')
                      AND column_name NOT LIKE '\\_%'
                    ORDER BY ordinal_position
                """),
                {"t": table_name}
            )
            numeric_cols = [row[0] for row in cols_res.fetchall()]
        except Exception:
            numeric_cols = []

        if not numeric_cols:
            # Still show row count insight
            try:
                cnt = await db.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
                row_count = cnt.scalar() or 0
                pills.append({
                    "label": f"{file.filename} - Total Records",
                    "value": f"{row_count:,}",
                    "trend": "neutral",
                    "color": "blue",
                    "icon": "database",
                    "table": table_name,
                })
            except Exception:
                pass
            continue

        # For each numeric column, compute sum, avg, max, min
        for col in numeric_cols[:3]:   # max 3 cols per table to avoid noise
            try:
                agg_res = await db.execute(
                    text(f"""
                        SELECT
                            SUM("{col}")   AS total,
                            AVG("{col}")   AS avg_val,
                            MAX("{col}")   AS max_val,
                            MIN("{col}")   AS min_val,
                            COUNT(*)       AS row_count
                        FROM "{table_name}"
                        WHERE "{col}" IS NOT NULL
                    """)
                )
                row = agg_res.fetchone()
                if not row or row[0] is None:
                    continue

                total   = float(row[0])
                avg_val = float(row[1])
                max_val = float(row[2])
                min_val = float(row[3])
                row_cnt = int(row[4])

                # Format value nicely
                def fmt(v: float) -> str:
                    if v >= 10_000_000:
                        return f"₹{v/10_000_000:.1f}Cr"
                    elif v >= 100_000:
                        return f"₹{v/100_000:.1f}L"
                    elif v >= 1_000:
                        return f"₹{v/1_000:.1f}K"
                    else:
                        return f"{v:,.0f}"

                # Determine trend by comparing first-half vs second-half rows
                trend = "neutral"
                color = "blue"
                try:
                    half = row_cnt // 2
                    if half > 0:
                        first_res = await db.execute(
                            text(f"""
                                SELECT AVG("{col}") FROM (
                                    SELECT "{col}" FROM "{table_name}"
                                    WHERE "{col}" IS NOT NULL
                                    LIMIT {half}
                                ) t
                            """)
                        )
                        second_res = await db.execute(
                            text(f"""
                                SELECT AVG("{col}") FROM (
                                    SELECT "{col}" FROM "{table_name}"
                                    WHERE "{col}" IS NOT NULL
                                    OFFSET {half}
                                ) t
                            """)
                        )
                        first_avg  = float(first_res.scalar() or 0)
                        second_avg = float(second_res.scalar() or 0)
                        if first_avg > 0:
                            pct_change = ((second_avg - first_avg) / first_avg) * 100
                            if pct_change > 5:
                                trend = "up"
                                color = "green"
                            elif pct_change < -5:
                                trend = "down"
                                color = "red"
                            else:
                                trend = "neutral"
                                color = "blue"
                except Exception:
                    pass

                # Anomaly detection: if max > 3x avg, flag warning
                if max_val > 3 * avg_val and avg_val > 0:
                    pills.append({
                        "label": f"Anomaly in {col} ({file.filename})",
                        "value": f"Max {fmt(max_val)} vs Avg {fmt(avg_val)}",
                        "trend": "warning",
                        "color": "orange",
                        "icon": "alert",
                        "table": table_name,
                    })

                pills.append({
                    "label": f"Total {col.replace('_', ' ').title()} ({file.filename})",
                    "value": fmt(total),
                    "trend": trend,
                    "color": color,
                    "icon": "trending_up" if trend == "up" else ("trending_down" if trend == "down" else "bar_chart"),
                    "table": table_name,
                    "meta": {
                        "avg": round(avg_val, 2),
                        "max": round(max_val, 2),
                        "min": round(min_val, 2),
                        "rows": row_cnt,
                    }
                })

            except Exception:
                continue

    return pills[:12]   # Return at most 12 pills to keep dashboard clean
