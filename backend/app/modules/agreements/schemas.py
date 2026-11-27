from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.users.schemas import ORMModel, UserOut
from app.modules.partners.schemas import PartnerOut
from app.modules.workflows.schemas import WorkflowEventOut

# Exactly nine statuses, exact order, per REBUILD_BRIEF.md Section 2.2.
AgreementStatus = Literal[
    "draft_generated",
    "linkages_review",
    "legal_review",
    "returned_to_researcher",
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
    document_type: str = Field(default="MoU", min_length=2, max_length=120)
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
    original_filename: str | None = None
    content_type: str | None = None
    file_size: int | None = None
    uploaded_by: UserOut
    timestamp: datetime
    status_at_time: str
    is_final: bool


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


class ProgressSubmissionCreate(BaseModel):
    reporting_period: str = Field(min_length=4, max_length=30)
    note: str | None = Field(default=None, max_length=20000)
    idempotency_key: str = Field(min_length=8, max_length=255)


class ProgressWorkspaceOut(ORMModel):
    id: int
    agreement_id: int
    template_id: int
    spreadsheet_file_id: str | None = None
    spreadsheet_url: str | None = None
    status: str
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class ProgressSubmissionOut(ORMModel):
    id: int
    agreement_id: int
    workspace_id: int
    reporting_period: str
    sequence_number: int
    submitted_by: UserOut
    note: str | None = None
    spreadsheet_modified_time: str | None = None
    snapshot_storage_key: str | None = None
    submitted_at: datetime
    status: str


# Statuses in which the live Google Doc link is withheld from every API response.
DOC_LINK_LOCKED_STATUSES = {"approved_for_signing", "awaiting_signatures"}


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
    # GOOGLE_DOCS_DRAFTING_BRIEF.md Section 4 — the live Google Doc for the
    # current drafting cycle; None once no template copy has been made yet.
    template_copy_url: str | None = None
    approved_at: datetime | None = None
    approved_by_name: str | None = None
    # True when the Doc was modified after Legal approved it. None when unknown
    # (not approved yet, or Drive could not be reached).
    doc_modified_after_approval: bool | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def _lock_doc_link_after_approval(self):
        # Between Legal approval and the signed upload, nobody opens the Doc
        # from Accord 360: the approved text is final, and Linkages works from
        # the exported signing copy. The link returns once the signed version
        # is uploaded.
        if self.status in DOC_LINK_LOCKED_STATUSES:
            self.template_copy_url = None
        return self


class AgreementDetailOut(AgreementListOut):
    versions: list[AgreementVersionOut] = []
    progress_updates: list[ProgressUpdateOut] = []
    progress_workspace: ProgressWorkspaceOut | None = None
    progress_submissions: list[ProgressSubmissionOut] = []
    workflow_events: list[WorkflowEventOut] = []
    available_actions: list[str] = []
