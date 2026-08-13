from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "InsightAI MIS & AI Analytics Platform"
    API_V1_STR: str = "/api"
    
    # Database Configuration
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/insightai"
    
    # Security Configuration
    JWT_SECRET_KEY: str = "supersecretkey_change_in_production_1234567890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # AI API Keys
    GEMINI_API_KEY: Optional[str] = None
    
    # Uploads Storage
    UPLOAD_DIR: str = "uploads"
    
    # SMTP Email Configuration
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    # Twilio WhatsApp Configuration
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"
    
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True
    )

settings = Settings()
