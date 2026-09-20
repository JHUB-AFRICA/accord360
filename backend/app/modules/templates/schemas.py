from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.users.schemas import ORMModel, UserOut


class TemplateCreate(BaseModel):
    document_type: str = Field(min_length=2, max_length=120)


class TemplateOut(ORMModel):
    id: int
    document_type: str
    file: str
    is_active: bool
    uploaded_by: UserOut
    timestamp: datetime
    present: list[str] = []
    missing_required: list[str] = []
    unknown_tokens: list[str] = []
    validated: bool = False


class FieldDefinitionCreate(BaseModel):
    field_name: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=240)
    required: bool = True


class FieldDefinitionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=240)
    required: bool | None = None


class FieldDefinitionOut(ORMModel):
    id: int
    field_name: str
    label: str
    required: bool
