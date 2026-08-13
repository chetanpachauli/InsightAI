from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from typing import Optional, List, Any

# --- User & Auth Schemas ---
class UserBase(BaseModel):
    email: EmailStr
    role: str = "Employee" # Admin, CEO, Manager, MIS, Employee

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str

# --- File & ETL Schemas ---
class FileOut(BaseModel):
    id: int
    filename: str
    version: int
    file_path: str
    status: str
    workflow_status: str
    owner_id: int
    approved_by_id: Optional[int] = None
    lineage_info: Optional[Any] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Rule Engine Schemas ---
class RuleCreate(BaseModel):
    name: str
    rule_type: str = "CUSTOM"
    condition_col: str
    operator: str
    value: str
    action_type: str = "ALERT"
    recipient: Optional[str] = None
    webhook_url: Optional[str] = None

class RuleOut(RuleCreate):
    id: int
    is_active: bool
    owner_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
