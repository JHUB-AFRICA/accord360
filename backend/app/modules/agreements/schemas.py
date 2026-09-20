from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.users.schemas import ORMModel, UserOut
from app.modules.partners.schemas import PartnerOut
from app.modules.workflows.schemas import WorkflowEventOut

# Exactly nine statuses, exact order, per REBUILD_BRIEF.md Section 2.2.
AgreementStatus = Literal[
    "draft_generated",
    "pending_legal_review",
    "returned_for_corrections",
    "pending_legal_verification",
    "approved_for_signing",
    "awaiting_signatures",
    "fully_executed",
    "expired",
    "archived",
]


class AgreementCreate(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    department: str = Field(min_length=2, max_length=180)
    partner_id: int
    start_date: date
    end_date: date
    document_type: str = Field(default="Standard MoU", min_length=2, max_length=120)
    field_values: dict[str, Any] = Field(default_factory=dict)


class AgreementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=300)
    department: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class AgreementVersionOut(ORMModel):
    id: int
    agreement_id: int
    file: str
    uploaded_by: UserOut
    timestamp: datetime
    status_at_time: str
    is_final: bool


class CommentOut(ORMModel):
    id: int
    version_id: int
    author: UserOut
    text: str
    status: str
    section_reference: str | None
    timestamp: datetime


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    section_reference: str | None = Field(default=None, max_length=300)


class CommentUpdate(BaseModel):
    status: Literal["open", "resolved"]


class ProgressUpdateOut(ORMModel):
    id: int
    agreement_id: int
    quarter: str
    notes: str
    submitted_by: UserOut
    created_at: datetime


class ProgressUpdateCreate(BaseModel):
    quarter: str = Field(min_length=7, max_length=20)
    notes: str = Field(min_length=1, max_length=20000)


class AgreementListOut(ORMModel):
    id: int
    title: str
    department: str
    status: AgreementStatus
    partner: PartnerOut
    researcher: UserOut
    start_date: date
    end_date: date
    expiry_alert_date: date | None
    expiry_notified: bool
    archived: bool
    days_to_expiry: int | None = None
    created_at: datetime
    updated_at: datetime


class AgreementDetailOut(AgreementListOut):
    versions: list[AgreementVersionOut] = []
    progress_updates: list[ProgressUpdateOut] = []
    workflow_events: list[WorkflowEventOut] = []
    available_actions: list[str] = []
