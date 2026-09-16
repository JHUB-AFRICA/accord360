from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.modules.users.schemas import ORMModel, UserOut


TemplateStatus = Literal["active", "archived"]


class TemplateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=240)
    agreement_type: Literal["MoU", "CRA", "CA", "Other"]
    version: str = Field(min_length=1, max_length=30)
    description: str | None = Field(default=None, max_length=4000)


class TemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=240)
    description: str | None = Field(default=None, max_length=4000)
    status: TemplateStatus | None = None


class TemplateOut(ORMModel):
    id: int
    name: str
    agreement_type: str
    version: str
    description: str | None
    status: TemplateStatus
    original_name: str | None
    mime_type: str | None
    size_bytes: int
    uploaded_by: UserOut
    created_at: datetime
    updated_at: datetime
