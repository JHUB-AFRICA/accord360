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


ApplicationStatus = Literal[
    "pending_email_verification",
    "pending_review",
    "needs_information",
    "approved",
    "rejected",
]


class PartnerApplicationDocumentOut(ORMModel):
    id: int
    original_name: str
    mime_type: str | None
    size_bytes: int
    created_at: datetime


class PartnerApplicationOut(ORMModel):
    id: int
    reference_number: str
    institution_name: str
    institution_type: str
    country: str
    region: str | None
    website: str
    registration_number: str | None
    contact_name: str
    job_title: str
    official_email: EmailStr
    phone: str
    collaboration_area: str
    strategic_alignment: str
    status: ApplicationStatus
    consent_at: datetime
    email_verified_at: datetime | None
    reviewed_by_id: int | None
    reviewed_at: datetime | None
    review_notes: str | None
    documents: list[PartnerApplicationDocumentOut] = Field(default_factory=list)


class PartnerApplicationReview(BaseModel):
    status: Literal["needs_information", "approved", "rejected"]
    review_notes: str = Field(min_length=3, max_length=4000)


class PartnerRegistrationResponse(BaseModel):
    reference_number: str
    status: ApplicationStatus
    message: str


class PartnerEmailVerificationResponse(BaseModel):
    reference_number: str
    status: ApplicationStatus
    message: str


class PartnerInvitationCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    membership_role: Literal["member", "administrator"] = "member"


class PartnerInvitationOut(ORMModel):
    id: int
    partner_id: int
    email: EmailStr
    full_name: str
    expires_at: datetime
    created_at: datetime
    message: str | None = None


class PartnerInvitationAccept(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class PartnerInvitationAcceptOut(BaseModel):
    reference_number: str
    status: Literal["accepted"]
    message: str


class PartnerWorkspaceOut(ORMModel):
    user: UserOut
    partner: PartnerOut
    membership_role: str


class PartnerAgreementOut(ORMModel):
    id: int
    reference_number: str
    title: str
    agreement_type: str
    partner_id: int
    stage: str
    status: str
    effective_date: date | None
    expiry_date: date | None
    updated_at: datetime


class PartnerDocumentOut(ORMModel):
    id: int
    agreement_id: int
    document_type: str
    version: str
    original_name: str
    mime_type: str | None
    size_bytes: int
    created_at: datetime


class PartnerAgreementDetailOut(PartnerAgreementOut):
    purpose: str
    documents: list[PartnerDocumentOut] = Field(default_factory=list)
