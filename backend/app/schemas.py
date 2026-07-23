from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

# BR-001: the initiator/owner role is called Champion (JKUAT Champion).
Role = Literal["admin", "champion", "linkages", "legal", "dvc", "vc_office", "executive", "me", "auditor"]
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
    role: Role = "champion"
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
    category: str | None = None
    country: str = "Kenya"
    county: str | None = None
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
    category: str | None
    country: str
    county: str | None
    contact_name: str | None
    contact_email: str | None
    legal_counterpart: str | None
    liaison: str | None
    status: str
    created_at: datetime


class PartnerCategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None


class PartnerCategoryOut(ORMModel):
    id: int
    name: str
    description: str | None
    is_active: bool


class TemplateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    agreement_type: AgreementType
    partner_category: str
    description: str | None = None
    body: str = ""


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    body: str | None = None
    is_active: bool | None = None


class TemplateOut(ORMModel):
    id: int
    name: str
    agreement_type: str
    partner_category: str
    description: str | None
    body: str
    version: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PartnerRequestCreate(BaseModel):
    partner_name: str = Field(min_length=2, max_length=240)
    sector: str | None = None
    category: str | None = None
    country: str = "Kenya"
    county: str | None = None
    collaboration_area: str
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    notes: str | None = None


class PartnerRequestAssign(BaseModel):
    champion_id: int


class PartnerRequestOut(ORMModel):
    id: int
    partner_name: str
    sector: str | None
    category: str | None
    country: str
    county: str | None
    collaboration_area: str
    contact_name: str | None
    contact_email: str | None
    notes: str | None
    status: str
    champion: UserOut | None
    logged_by: UserOut
    agreement_id: int | None
    created_at: datetime


class AgreementCreate(BaseModel):
    title: str
    agreement_type: AgreementType
    purpose: str
    expected_outcomes: str | None = None
    strategic_alignment: str | None = None
    department: str
    partner_id: int
    partner_category: str | None = None
    template_id: int | None = None
    partner_request_id: int | None = None
    confidentiality: str = "internal"
    partner_liaison: str | None = None
    effective_date: date | None = None
    expiry_date: date | None = None


class AgreementUpdate(BaseModel):
    title: str | None = None
    purpose: str | None = None
    expected_outcomes: str | None = None
    strategic_alignment: str | None = None
    department: str | None = None
    partner_category: str | None = None
    confidentiality: str | None = None
    partner_liaison: str | None = None
    effective_date: date | None = None
    expiry_date: date | None = None
    signing_date: date | None = None
    date_sent_vc: date | None = None
    date_sent_partner: date | None = None
    assigned_linkages_id: int | None = None
    legal_reviewer_id: int | None = None
    next_action: str | None = None


class AgreementListOut(ORMModel):
    id: int
    reference_number: str
    title: str
    agreement_type: str
    department: str
    source: str
    partner_category: str | None
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
    checksum_sha256: str | None
    is_official: bool
    is_locked: bool
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


class LegalFeedbackCreate(BaseModel):
    message: str = Field(min_length=1)
    document_version: str | None = None


class LegalFeedbackOut(ORMModel):
    id: int
    agreement_id: int
    message: str
    document_version: str | None
    created_at: datetime
    author: UserOut


class MEReportSubmit(BaseModel):
    activities: str = Field(min_length=1)
    outcomes: str = Field(min_length=1)
    challenges: str | None = None
    evidence_document_id: int | None = None


class MEReportDecision(BaseModel):
    feedback: str | None = None

    @model_validator(mode="after")
    def _noop(self):
        return self


class MEScheduleOut(ORMModel):
    id: int
    agreement_id: int
    period_label: str
    due_date: date
    status: str
    activities: str | None
    outcomes: str | None
    challenges: str | None
    evidence_document_id: int | None
    submitted_by: UserOut | None
    submitted_at: datetime | None
    validated_by: UserOut | None
    validated_at: datetime | None
    feedback: str | None
    days_to_due: int
    is_overdue: bool


class VcGateOut(BaseModel):
    legal_approved: bool
    dvc_signed: bool
    vc_submitted: bool


class AgreementDetailOut(AgreementListOut):
    purpose: str
    expected_outcomes: str | None
    strategic_alignment: str | None
    confidentiality: str
    partner_liaison: str | None
    signing_date: date | None
    date_sent_vc: date | None
    date_sent_partner: date | None
    template_id: int | None
    template_version: str | None
    legal_approved_at: datetime | None
    legal_approved_version: str | None
    dvc_signed_at: datetime | None
    vc_submitted_at: datetime | None
    vc_gate: VcGateOut
    documents: list[DocumentOut]
    workflow_events: list[WorkflowEventOut]
    deliverables: list[DeliverableOut]
    values: list[ValueRecordOut]


class TransitionRequest(BaseModel):
    action: Literal[
        "submit",
        "return_correction",
        "send_legal",
        "approve_legal",
        "dvc_sign",
        "dvc_return",
        "submit_vc",
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
        if self.action in {"return_correction", "dvc_return", "reject"} and not (self.comment or "").strip():
            raise ValueError("A reason is required when returning or rejecting a request")
        return self


class ScorecardCriterionOut(ORMModel):
    id: int
    key: str
    label: str
    description: str | None
    weight: int
    sort_order: int


class ScorecardWeightUpdate(BaseModel):
    weights: dict[str, int]

    @model_validator(mode="after")
    def total_100(self):
        if sum(self.weights.values()) != 100:
            raise ValueError("Scorecard weights must total exactly 100")
        if any(w < 0 or w > 100 for w in self.weights.values()):
            raise ValueError("Each weight must be between 0 and 100")
        return self


class QualitativeScoreUpdate(BaseModel):
    score: int = Field(ge=0, le=100)
    note: str | None = None


class FAQCreate(BaseModel):
    question: str = Field(min_length=5, max_length=300)
    answer: str = Field(min_length=5)
    keywords: str = ""
    category: str = "General"
    is_active: bool = True


class FAQOut(ORMModel):
    id: int
    question: str
    answer: str
    keywords: str
    category: str
    is_active: bool


class ChatAsk(BaseModel):
    question: str = Field(min_length=2, max_length=500)


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
