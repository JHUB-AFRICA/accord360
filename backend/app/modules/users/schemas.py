from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# Exactly four roles per REBUILD_BRIEF.md Section 2.1.
Role = Literal["researcher", "linkages", "legal", "me"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class DemoSignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Role
    department: str | None = Field(default=None, max_length=160)

class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    password: str = Field(min_length=8)
    role: Role = "researcher"
    department: str | None = None

class UserUpdate(BaseModel):
    full_name: str | None = None
    role: Role | None = None
    department: str | None = None
    is_active: bool | None = None

class UserOut(ORMModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    department: str | None
    is_active: bool
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
