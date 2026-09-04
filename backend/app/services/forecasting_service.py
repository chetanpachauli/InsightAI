"""
Forecasting Service - Part 2 Feature
Generates 30/90 day predictions using linear regression on numeric time-series data.
No heavy ML library needed - pure Python math (works on Render free tier).
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any, Optional
import re
import math


def _linear_regression(x: List[float], y: List[float]):
    """Simple least-squares linear regression. Returns (slope, intercept)."""
    n = len(x)
    if n < 2:
        return 0.0, y[0] if y else 0.0
    sum_x  = sum(x)
    sum_y  = sum(y)
    sum_xy = sum(xi * yi for xi, yi in zip(x, y))
    sum_xx = sum(xi * xi for xi in x)
    denom  = n * sum_xx - sum_x ** 2
    if denom == 0:
        return 0.0, sum_y / n
    slope     = (n * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n
    return slope, intercept


def _moving_average(values: List[float], window: int = 3) -> List[float]:
    """Simple moving average smoothing."""
    result = []
    for i in range(len(values)):
        start = max(0, i - window + 1)
        result.append(sum(values[start:i+1]) / (i - start + 1))
    return result


def _confidence_band(values: List[float], slope: float) -> float:
    """Estimate ±% confidence based on data variance."""
    if not values:
        return 10.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std_dev = math.sqrt(variance)
    cv = (std_dev / mean * 100) if mean != 0 else 10.0
    # Clamp between 5% and 30%
    return round(min(30.0, max(5.0, cv)), 1)


async def get_forecast(
    db: AsyncSession,
    table_name: str,
    column_name: str,
    horizon_days: int = 30,
) -> Dict[str, Any]:
    """
    Forecast future values for a given numeric column in a table.

    Returns:
        historical: list of {index, value, smoothed}
        forecast:   list of {index, value, upper, lower}
        trend:      'up' | 'down' | 'flat'
        confidence: percentage (e.g. 8.5)
        summary:    human-readable string
    """
    # Security: sanitize inputs
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name):
        return {"error": "Invalid table name"}
    if not re.match(r'^[a-zA-Z0-9_]+$', column_name):
        return {"error": "Invalid column name"}

    # Verify table exists
    try:
        exists = await db.execute(
            text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :t)"),
            {"t": table_name}
        )
        if not exists.scalar():
            return {"error": f"Table '{table_name}' does not exist"}
    except Exception as e:
        return {"error": str(e)}

    # Fetch column values in insertion order
    try:
        res = await db.execute(
            text(f'SELECT "{column_name}" FROM "{table_name}" WHERE "{column_name}" IS NOT NULL ORDER BY _row_id LIMIT 500')
        )
        raw_values = [float(r[0]) for r in res.fetchall() if r[0] is not None]
    except Exception:
        # Fallback: no _row_id column
        try:
            res = await db.execute(
                text(f'SELECT "{column_name}" FROM "{table_name}" WHERE "{column_name}" IS NOT NULL LIMIT 500')
            )
            raw_values = [float(r[0]) for r in res.fetchall() if r[0] is not None]
        except Exception as e:
            return {"error": f"Could not read column: {str(e)}"}

    if len(raw_values) < 3:
        return {"error": "Not enough data points (minimum 3 required) for forecasting"}

    # Smooth historical data
    smoothed = _moving_average(raw_values, window=min(5, len(raw_values)))

    # Fit linear regression on smoothed data
    x_vals = list(range(len(smoothed)))
    slope, intercept = _linear_regression(x_vals, smoothed)

    # Confidence band
    conf = _confidence_band(raw_values, slope)

    # Build historical payload (max 50 points for chart performance)
    step = max(1, len(raw_values) // 50)
    historical = []
    for i in range(0, len(raw_values), step):
        historical.append({
            "index": i + 1,
            "value": round(raw_values[i], 2),
            "smoothed": round(smoothed[i], 2),
        })

    # Build forecast payload (horizon_days points)
    n = len(smoothed)
    forecast = []
    for i in range(1, horizon_days + 1):
        predicted = slope * (n + i) + intercept
        predicted = max(0, predicted)   # no negative values
        margin    = predicted * (conf / 100)
        forecast.append({
            "index": n + i,
            "value": round(predicted, 2),
            "upper": round(predicted + margin, 2),
            "lower": round(max(0, predicted - margin), 2),
        })

    # Trend label
    if slope > 0.01:
        trend = "up"
    elif slope < -0.01:
        trend = "down"
    else:
        trend = "flat"

    # Summary text
    last_val    = raw_values[-1]
    forecast_30 = forecast[min(29, len(forecast)-1)]["value"]

    def fmt(v: float) -> str:
        if v >= 10_000_000:
            return f"₹{v/10_000_000:.1f}Cr"
        elif v >= 100_000:
            return f"₹{v/100_000:.1f}L"
        elif v >= 1_000:
            return f"₹{v/1_000:.1f}K"
        else:
            return f"{v:,.0f}"

    if trend == "up":
        pct = ((forecast_30 - last_val) / last_val * 100) if last_val else 0
        summary = f"📈 {column_name.replace('_',' ').title()} is trending UP. Projected {horizon_days}-day value: {fmt(forecast_30)} (+{pct:.1f}%)"
    elif trend == "down":
        pct = ((last_val - forecast_30) / last_val * 100) if last_val else 0
        summary = f"📉 {column_name.replace('_',' ').title()} is trending DOWN. Projected {horizon_days}-day value: {fmt(forecast_30)} (-{pct:.1f}%)"
    else:
        summary = f"➡️ {column_name.replace('_',' ').title()} is STABLE. Projected {horizon_days}-day value: {fmt(forecast_30)}"

    return {
        "table": table_name,
        "column": column_name,
        "horizon_days": horizon_days,
        "data_points": len(raw_values),
        "trend": trend,
        "confidence_pct": conf,
        "historical": historical,
        "forecast": forecast,
        "summary": summary,
        "last_value": round(last_val, 2),
        "forecast_value": round(forecast_30, 2),
    }


async def get_forecastable_columns(db: AsyncSession, table_name: str) -> List[str]:
    """Return numeric columns available for forecasting in a given table."""
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name):
        return []
    try:
        res = await db.execute(
            text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = :t
                  AND data_type IN ('integer','bigint','numeric','double precision','real','smallint')
                  AND column_name NOT LIKE '\\_%'
                ORDER BY ordinal_position
            """),
            {"t": table_name}
        )
        return [r[0] for r in res.fetchall()]
    except Exception:
        return []
