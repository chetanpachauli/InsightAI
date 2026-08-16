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
    # Startup: Apply schema if running in dev mode without migrations.
    # In production set AUTO_CREATE_TABLES=false and run `alembic upgrade head`.
    if settings.AUTO_CREATE_TABLES:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Database tables created successfully!")
    yield
    # Shutdown: Cleanup (if needed)
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
# Origins are restricted to the configured frontend URLs (see CORS_ORIGINS in .env).
# A wildcard origin ("*") combined with credentials is rejected by browsers, so we
# always use an explicit allowlist.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
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
def health_check():
    """Liveness probe for load balancers / orchestrators."""
    return {"status": "healthy"}
