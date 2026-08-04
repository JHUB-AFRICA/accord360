from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

AgreementType = Literal["MoU", "CRA", "CA", "Other"]
from app.modules.users.schemas import ORMModel, UserOut
from app.modules.partners.schemas import PartnerOut
from app.modules.workflows.schemas import DeliverableOut, ValueRecordOut, WorkflowEventOut

class AgreementCreate(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    agreement_type: AgreementType
    purpose: str = Field(min_length=10)
    expected_outcomes: str | None = None
    strategic_alignment: str | None = None
    department: str = Field(min_length=2, max_length=180)
    partner_id: int
    champion_user_id: int | None = None
    confidentiality: str = "internal"
    internal_champion: str | None = None
    partner_liaison: str | None = None
    effective_date: date | None = None
    expiry_date: date | None = None

class AgreementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=300)
    purpose: str | None = Field(default=None, min_length=10)
    expected_outcomes: str | None = None
    strategic_alignment: str | None = None
    department: str | None = None
    confidentiality: str | None = None
    internal_champion: str | None = None
    partner_liaison: str | None = None
    effective_date: date | None = None
    expiry_date: date | None = None
    signing_date: date | None = None
    date_sent_vc: date | None = None
    date_sent_partner: date | None = None
    assigned_approver_id: int | None = None
    assigned_linkages_id: int | None = None
    legal_reviewer_id: int | None = None
    next_action: str | None = None

class AgreementListOut(ORMModel):
    id: int
    reference_number: str
    title: str
    agreement_type: str
    department: str
    stage: str
    status: str
    status_color: str
    next_action: str | None
    partner: PartnerOut
    owner: UserOut
    effective_date: date | None
    expiry_date: date | None
    legal_review_days: int | None = None
    days_to_expiry: int | None = None
    created_at: datetime
    updated_at: datetime

class DocumentOut(ORMModel):
    id: int
    agreement_id: int
    document_type: str
    version: str
    original_name: str
    mime_type: str | None
    size_bytes: int
    is_official: bool
    confidentiality: str
    created_at: datetime

class AgreementDetailOut(AgreementListOut):
    purpose: str
    expected_outcomes: str | None
    strategic_alignment: str | None
    confidentiality: str
    internal_champion: str | None
    partner_liaison: str | None
    signing_date: date | None
    date_sent_vc: date | None
    date_sent_partner: date | None
    documents: list[DocumentOut]
    workflow_events: list[WorkflowEventOut]
    deliverables: list[DeliverableOut]
    values: list[ValueRecordOut]
