from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import engine, Base

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
    # Startup: Create database tables
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

# Set up CORS middleware to allow React (Next.js) to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
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
