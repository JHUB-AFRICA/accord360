from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.users.schemas import ORMModel

class PartnerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=240)
    sector: str = Field(min_length=2, max_length=120)
    partner_type: str = "Institution"
    country: str = "Kenya"
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    legal_counterpart: str | None = None
    liaison: str | None = None
    status: str = "active"

class PartnerOut(ORMModel):
    id: int
    name: str = Field(min_length=2, max_length=240)
    sector: str = Field(min_length=2, max_length=120)
    partner_type: str
    country: str
    contact_name: str | None
    contact_email: str | None
    legal_counterpart: str | None
    liaison: str | None
    status: str
    created_at: datetime

