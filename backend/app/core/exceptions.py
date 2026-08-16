"""
Global exception handling.

Every endpoint can raise `APIException` (or any HTTPException) and receive a
standard JSON error envelope:

    {
      "error": "not_found",
      "message": "File not found",
      "request_id": "...",
      "details": {...}   # optional
    }

Unexpected errors are logged with full traceback and returned as a generic 500
so internal details never leak to clients.
"""
from typing import Any, Dict, Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging_setup import get_logger, get_request_id

logger = get_logger("errors")


class APIException(Exception):
    """Application-level error with an HTTP status and machine-readable code."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


def _error_payload(code: str, message: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "error": code,
        "message": message,
        "request_id": get_request_id(),
    }
    if details is not None:
        payload["details"] = details
    return payload


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(APIException)
    async def api_exception_handler(request: Request, exc: APIException):
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        # HTTPException raised with `detail` -> fall back to a generic code
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload("http_error", str(exc.detail)),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err.get("loc", []))
            errors.append({"field": loc, "message": err.get("msg", "invalid")})
        return JSONResponse(
            status_code=422,
            content=_error_payload("validation_error", "Request validation failed", {"errors": errors}),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception(
            "Unhandled exception",
            extra={"method": request.method, "path": request.url.path},
        )
        return JSONResponse(
            status_code=500,
            content=_error_payload("internal_error", f"Internal error: {str(exc)}"),
        )
