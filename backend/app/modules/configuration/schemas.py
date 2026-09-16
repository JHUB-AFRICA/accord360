from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.users.schemas import ORMModel, UserOut


class ConfigurationCreate(BaseModel):
    key: str = Field(min_length=2, max_length=120, pattern=r"^[a-z][a-z0-9_.-]*$")
    category: str = Field(min_length=2, max_length=80)
    value: str = Field(max_length=10000)
    description: str | None = Field(default=None, max_length=4000)
    is_editable: bool = True


class ConfigurationUpdate(BaseModel):
    value: str = Field(max_length=10000)
    description: str | None = Field(default=None, max_length=4000)
    is_editable: bool | None = None


class ConfigurationOut(ORMModel):
    id: int
    key: str
    category: str
    value: str
    description: str | None
    is_editable: bool
    updated_by: UserOut | None
    created_at: datetime
    updated_at: datetime


class ReferenceDataCreate(BaseModel):
    category: str = Field(min_length=2, max_length=80)
    code: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=180)
    value: str | None = Field(default=None, max_length=4000)
    is_active: bool = True
    sort_order: int = 0


class ReferenceDataUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=180)
    value: str | None = Field(default=None, max_length=4000)
    is_active: bool | None = None
    sort_order: int | None = None


class ReferenceDataOut(ORMModel):
    id: int
    category: str
    code: str
    label: str
    value: str | None
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
