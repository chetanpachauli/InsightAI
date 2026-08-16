from pydantic_settings import BaseSettings
from pydantic import ConfigDict, field_validator
from typing import Optional, List

class Settings(BaseSettings):
    PROJECT_NAME: str = "InsightAI MIS & AI Analytics Platform"
    API_V1_STR: str = "/api"
    
    # Database Configuration
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/insightai"
    # Echo all generated SQL to console (useful for dev, disable in production)
    DB_ECHO: bool = False
    # Auto-create tables on startup (dev convenience). In production set to false
    # and use `alembic upgrade head` so schema changes go through migrations.
    AUTO_CREATE_TABLES: bool = True
    
    # Security Configuration
    JWT_SECRET_KEY: str = ""  # MUST be set via .env / environment in any environment
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Mark refresh-token cookie as Secure (requires HTTPS). Enable in production.
    COOKIE_SECURE: bool = False
    # Comma-separated list of allowed CORS origins (frontend URLs)
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    # Rate-limit counter storage: "memory://" (dev/single instance) or a Redis URL (production)
    RATE_LIMIT_STORAGE: str = "memory://"
    
    # AI API Keys
    GEMINI_API_KEY: Optional[str] = None

    # Error Monitoring (Sentry). Leave empty to disable.
    SENTRY_DSN: Optional[str] = None
    # % of transactions sampled for performance tracing (0.0 - 1.0)
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_ENVIRONMENT: str = "production"
    
    # Uploads Storage
    UPLOAD_DIR: str = "uploads"
    # Max allowed upload size in MB (files, documents, statements, scraped sheets)
    MAX_FILE_UPLOAD_MB: int = 50
    
    # SMTP Email Configuration
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    # Twilio WhatsApp Configuration
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"
    
    @field_validator("DATABASE_URL")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if not v:
            return v
        # Render, Supabase, and Heroku provide postgres:// or postgresql://
        # Convert to postgresql+asyncpg:// for SQLAlchemy async engine
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        # Reject the old insecure hardcoded placeholder
        if not v or "supersecretkey" in v.lower() or "replace_with" in v.lower():
            raise ValueError(
                "JWT_SECRET_KEY must be set to a strong random value in your .env file."
            )
        return v
    
    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
    
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
