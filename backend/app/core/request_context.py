"""
Request context middleware.

Assigns a UUID to every incoming request and exposes it as a `request_id`
header in the response, plus on the root logger via contextvars. This enables
correlation across app logs, database queries, and third-party providers
(Sentry, nginx access logs, etc.).
"""
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging_setup import get_logger, set_request_id

logger = get_logger("request")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        set_request_id(request_id)

        start = time.perf_counter()
        try:
            response: Response = await call_next(request)
        except Exception:
            logger.exception("Unhandled exception during request")
            raise
        finally:
            set_request_id(None)

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request completed",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": getattr(response, "status_code", 500),
                "duration_ms": duration_ms,
            },
        )
        return response
