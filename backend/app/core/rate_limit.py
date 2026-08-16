"""
Rate limiting setup.

Storage is configurable via RATE_LIMIT_STORAGE:
  - "memory://"            : in-process counters (default; ideal for dev/single instance)
  - "redis://redis:6379/0" : shared counters across instances (production)

Usage in endpoints (decorate the endpoint, which must accept `request: Request`):
    @router.post("/login", response_model=TokenResponse)
    @limiter.limit("5/minute")
    async def login(request: Request, ...):
        ...
"""
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.RATE_LIMIT_STORAGE,
    headers_enabled=True,
)

# Rate limit presets (strings passed to @limiter.limit(...))
LOGIN_RATE_LIMIT = "5/minute"       # brute-force guard
REGISTER_RATE_LIMIT = "3/hour"      # mass account-creation guard
GENERAL_RATE_LIMIT = "120/minute"   # normal API traffic
AI_RATE_LIMIT = "30/minute"         # Gemini-backed endpoints (cost/abuse guard)
SCRAPER_RATE_LIMIT = "10/minute"    # External scrape + LLM extract
UPLOAD_RATE_LIMIT = "20/minute"     # File / document / finance uploads


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Standard JSON error envelope for 429 responses."""
    from fastapi.responses import JSONResponse
    from app.core.exceptions import _error_payload

    return JSONResponse(
        status_code=429,
        content=_error_payload("rate_limited", "Too many requests. Please slow down and try again later."),
    )
