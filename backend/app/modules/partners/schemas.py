from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.users.schemas import ORMModel
from app.modules.users.schemas import UserOut

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


PartnerReviewStatus = Literal["active", "under_review", "additional_information_required", "rejected"]


class PartnerReviewCreate(BaseModel):
    status: PartnerReviewStatus
    reason: str = Field(min_length=3, max_length=4000)


class PartnerReviewOut(ORMModel):
    id: int
    partner_id: int
    reviewer: UserOut
    old_status: str | None
    new_status: PartnerReviewStatus
    reason: str
    created_at: datetime
