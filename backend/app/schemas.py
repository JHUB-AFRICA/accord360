from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

Role = Literal["admin", "researcher", "approver", "linkages", "legal", "executive", "me", "auditor"]
AgreementType = Literal["MoU", "CRA", "CA", "Other"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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


class PartnerCreate(BaseModel):
    name: str
    sector: str
    partner_type: str = "Institution"
    country: str = "Kenya"
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    legal_counterpart: str | None = None
    liaison: str | None = None
    status: str = "active"


class PartnerOut(ORMModel):
    id: int
    name: str
    sector: str
    partner_type: str
    country: str
    contact_name: str | None
    contact_email: str | None
    legal_counterpart: str | None
    liaison: str | None
    status: str
    created_at: datetime


class AgreementCreate(BaseModel):
    title: str
    agreement_type: AgreementType
    purpose: str
    expected_outcomes: str | None = None
    strategic_alignment: str | None = None
    department: str
    partner_id: int
    confidentiality: str = "internal"
    internal_champion: str | None = None
    partner_liaison: str | None = None
    effective_date: date | None = None
    expiry_date: date | None = None


class AgreementUpdate(BaseModel):
    title: str | None = None
    purpose: str | None = None
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
    days_in_stage: int
    sla_target_days: int | None
    sla_state: str
    expiry_days: int | None
    created_at: datetime
    updated_at: datetime


class DocumentOut(ORMModel):
    id: int
    agreement_id: int
    document_type: str
    version: str
    original_name: str
    stored_name: str
    mime_type: str | None
    size_bytes: int
    is_official: bool
    confidentiality: str
    created_at: datetime


class WorkflowEventOut(ORMModel):
    id: int
    from_stage: str | None
    to_stage: str
    action: str
    comment: str | None
    created_at: datetime
    actor: UserOut


class DeliverableCreate(BaseModel):
    deliverable_type: str
    target_value: Decimal = 0
    actual_value: Decimal = 0
    reporting_period: str | None = None
    notes: str | None = None


class DeliverableOut(ORMModel):
    id: int
    agreement_id: int
    deliverable_type: str
    target_value: Decimal
    actual_value: Decimal
    reporting_period: str | None
    notes: str | None
    last_updated_at: datetime


class ValueRecordCreate(BaseModel):
    value_type: str
    amount: Decimal
    currency: str = "KES"
    source: str | None = None
    reporting_period: str | None = None
    approved: bool = True


class ValueRecordOut(ORMModel):
    id: int
    agreement_id: int
    value_type: str
    amount: Decimal
    currency: str
    source: str | None
    reporting_period: str | None
    approved: bool


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


class TransitionRequest(BaseModel):
    action: Literal[
        "submit",
        "approve_department",
        "return_correction",
        "approve_linkages",
        "send_legal",
        "approve_legal",
        "send_signing",
        "mark_signed",
        "activate",
        "renew",
        "close",
        "archive",
        "reject",
    ]
    comment: str | None = None

    @model_validator(mode="after")
    def require_decision_reason(self):
        if self.action in {"return_correction", "reject"} and not (self.comment or "").strip():
            raise ValueError("A reason is required when returning or rejecting a request")
        return self


class NotificationOut(ORMModel):
    id: int
    title: str
    message: str
    level: str
    is_read: bool
    agreement_id: int | None
    created_at: datetime


class AuditLogOut(ORMModel):
    id: int
    action: str
    object_type: str
    object_id: str
    old_value: str | None
    new_value: str | None
    source_ip: str | None
    created_at: datetime
    actor: UserOut | None
