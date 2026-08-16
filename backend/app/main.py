from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import engine, Base
from app.core.logging_setup import setup_logging, get_logger
from app.core.request_context import RequestContextMiddleware
from app.core.exceptions import register_exception_handlers
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# Initialize structured (JSON) logging before anything else
setup_logging()
logger = get_logger("startup")

# Initialize Sentry error monitoring (no-op when SENTRY_DSN is not configured)
if settings.SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        # Include user identity (id + email) in error reports when authenticated
        send_default_pii=True,
    )
    logger.info("Sentry error monitoring initialized")

# Import models to ensure they are registered with SQLAlchemy Base before creation
from app.models.users import User
from app.models.files import UploadedFile
from app.models.rules import AlertRule
from app.models.audit_logs import AuditLog
from app.models.documents import DocumentChunk

# Import API Routers
from app.api.auth import router as auth_router
from app.api.files import router as files_router
from app.api.rules import router as rules_router
from app.api.query import router as query_router
from app.api.documents import router as documents_router
from app.api.notifications import router as notifications_router
from app.api.finance import router as finance_router
from app.api.scraper import router as scraper_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure all tables exist in database on startup
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.warning(f"Database table initialization warning: {e}")
    yield
    print("Application shutdown")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Register global exception handlers (must be before adding middleware)
register_exception_handlers(app)

# Rate limiter state + handler (429 responses use the standard error envelope)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Attach request correlation middleware (assigns X-Request-ID + structured logs)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(SlowAPIMiddleware)

# Set up CORS middleware to allow React (Next.js) to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(files_router, prefix=settings.API_V1_STR)
app.include_router(rules_router, prefix=settings.API_V1_STR)
app.include_router(query_router, prefix=settings.API_V1_STR)
app.include_router(documents_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(finance_router, prefix=settings.API_V1_STR)
app.include_router(scraper_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} Backend API!"}

@app.get("/health")
async def health_check():
    """Enterprise deep health check: verifies API, Database connectivity, and AI services."""
    from sqlalchemy import text
    from app.core.database import SessionLocal
    from datetime import datetime, timezone

    db_status = "connected"
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"degraded: {str(e)}"

    is_healthy = "degraded" not in db_status
    return {
        "status": "healthy" if is_healthy else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "database": db_status,
            "gemini_ai": "configured" if settings.GEMINI_API_KEY else "unconfigured",
            "rate_limiter": settings.RATE_LIMIT_STORAGE
        }
    }
