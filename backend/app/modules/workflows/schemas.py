from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.users.schemas import ORMModel, UserOut

class WorkflowEventOut(ORMModel):
    id: int
    from_stage: str | None
    to_stage: str
    action: str
    comment: str | None
    created_at: datetime
    actor: UserOut


class CorrectionResponse(BaseModel):
    response_text: str = Field(min_length=3, max_length=4000)


class CorrectionResolution(BaseModel):
    resolution_notes: str = Field(min_length=3, max_length=4000)


class CorrectionOut(ORMModel):
    id: int
    agreement_id: int
    agreement_reference: str
    agreement_title: str
    partner_name: str
    workflow_event_id: int
    return_action: str
    status: Literal["pending", "responded", "resolved"]
    exact_item: str
    requested_change: str
    details: str | None
    requested_by: UserOut
    assigned_to: UserOut | None
    response_text: str | None
    responded_by: UserOut | None
    responded_at: datetime | None
    resolution_notes: str | None
    resolved_by: UserOut | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime

class DeliverableCreate(BaseModel):
    deliverable_type: str
    target_value: Decimal = Field(default=0, ge=0)
    actual_value: Decimal = Field(default=0, ge=0)
    reporting_period: str | None = None
    notes: str | None = None
    evidence_document_id: int | None = None

class DeliverableOut(ORMModel):
    id: int
    agreement_id: int
    deliverable_type: str
    target_value: Decimal
    actual_value: Decimal
    reporting_period: str | None
    notes: str | None
    evidence_document_id: int | None
    last_updated_at: datetime

class ValueRecordCreate(BaseModel):
    value_type: str
    amount: Decimal = Field(ge=0)
    currency: str = "KES"
    source: str | None = None
    reporting_period: str | None = None
    approved: bool = True

class ValueRecordOut(ORMModel):
    id: int
    agreement_id: int
    value_type: str
    amount: Decimal = Field(ge=0)
    currency: str
    source: str | None
    reporting_period: str | None
    approved: bool

class TransitionRequest(BaseModel):
    action: Literal[
        "submit",
        "approve_department",
        "return_correction",
        "approve_linkages",
        "send_legal",
        "approve_legal",
        "approve_dvc",
        "return_dvc",
        "submit_vc",
        "record_vc_signature",
        "mark_signed",
        "activate",
        "renew",
        "close",
        "archive",
        "reject",
    ]
    comment: str | None = Field(default=None, max_length=4000)
    exact_item: str | None = Field(default=None, max_length=300)
    requested_change: str | None = Field(default=None, max_length=4000)
    details: str | None = Field(default=None, max_length=4000)

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
