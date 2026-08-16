"""Redis-backed response cache with graceful degradation.

Caching is best-effort: if Redis is unreachable the helpers no-op so the
application keeps working. Only used for expensive, slow-changing responses
(e.g. Gemini AI insights).
"""
import json
from typing import Any, Optional

from app.core.config import settings

KEY_PREFIX = "insightai:cache:"


def cache_key(*parts: Any) -> str:
    return KEY_PREFIX + ":".join(str(p) for p in parts)


async def _client():
    try:
        from redis import asyncio as aioredis
        return aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    except Exception:
        return None


async def cache_get(key: str) -> Optional[str]:
    """Return cached string value or None (never raises)."""
    try:
        client = await _client()
        if client is None:
            return None
        return await client.get(key)
    except Exception:
        return None


async def cache_set(key: str, value: str, ttl_seconds: int) -> None:
    """Store a string value with TTL (never raises)."""
    try:
        client = await _client()
        if client is None:
            return
        await client.set(key, value, ex=ttl_seconds)
    except Exception:
        return


async def cache_get_json(key: str) -> Optional[Any]:
    raw = await cache_get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


async def cache_set_json(key: str, value: Any, ttl_seconds: int) -> None:
    try:
        await cache_set(key, json.dumps(value, default=str), ttl_seconds)
    except Exception:
        return
