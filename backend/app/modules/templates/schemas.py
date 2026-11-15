from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.users.schemas import ORMModel, UserOut


class TemplateCreate(BaseModel):
    document_type: str = Field(min_length=2, max_length=120)
    # GOOGLE_DOCS_DRAFTING_BRIEF.md Section 4 — the Google Doc id of the
    # master template (shared with the Drive service account as Editor).
    # This is what create_agreement actually copies; a Template can't be
    # activated without one (templates/service.py::activate_template).
    master_doc_id: str = Field(min_length=1, max_length=120)


class TemplateOut(ORMModel):
    id: int
    document_type: str
    file: str | None = None
    master_doc_id: str | None = None
    is_active: bool
    uploaded_by: UserOut
    timestamp: datetime


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
