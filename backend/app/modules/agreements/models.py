"""Agreement domain models — REBUILD_BRIEF.md Section 2.6.

Agreement.status is the single authoritative workflow field (there is no
separate "stage" concept anymore). AgreementVersion and ProgressUpdate are
new tables that replace the old flat `Document` model. The Comment model
that used to live here was removed in GOOGLE_DOCS_DRAFTING_BRIEF.md Phase D
— Legal's comments live natively in the Google Doc; Accord 360 only logs
that a "returned for corrections" event happened, via WorkflowEvent.comment.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.timeutils import utc_now

# Exactly nine statuses, exact order, per REBUILD_BRIEF.md Section 2.2.
AGREEMENT_STATUSES = (
    "draft_generated",
    "linkages_review",
    "legal_review",
    "returned_to_researcher",
    "approved_for_signing",
    "awaiting_signatures",
    "fully_executed",
    "expired",
    "archived",
)


class Agreement(Base, TimestampMixin):
    __tablename__ = "agreements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"), nullable=False)
    department: Mapped[str] = mapped_column(String(180), nullable=False)
    researcher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="draft_generated", index=True, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Computed once, at the awaiting_signatures -> fully_executed transition (Phase 3 / Section 4.3).
    expiry_alert_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_notified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # NOTE: `archived` (bool) tracks M&E's terminal action distinctly from the
    # `status` enum for querying convenience; `status` remains authoritative.
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # GOOGLE_DOCS_DRAFTING_BRIEF.md Section 4 — the live, editable Google Doc
    # copy for the current drafting cycle. Set once at create_agreement and
    # never touched again by Accord 360; Google Docs' own revision history
    # is authoritative for drafting-stage content, not these columns.
    template_copy_doc_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Legal's approval, recorded when the `approve` transition runs so Linkages
    # can see who approved, when, and whether the Doc changed afterwards
    # (approved_doc_modified_at is Drive's modifiedTime at approval).
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    approved_by_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    approved_doc_modified_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    template_copy_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Self-referencing renewal chain (spec Section 5/9's "First/Second Final
    # Signed Document"). Populating this on `expired -> renew` is explicitly
    # out of scope for the current brief — see its "Open items" section.
    renewal_of_id: Mapped[int | None] = mapped_column(ForeignKey("agreements.id"), nullable=True)

    partner: Mapped["Partner"] = relationship(back_populates="agreements")
    researcher: Mapped["User"] = relationship(back_populates="owned_agreements", foreign_keys=[researcher_id])
    versions: Mapped[list["AgreementVersion"]] = relationship(
        back_populates="agreement", cascade="all, delete-orphan", order_by="AgreementVersion.timestamp"
    )
    progress_updates: Mapped[list["ProgressUpdate"]] = relationship(
        back_populates="agreement", cascade="all, delete-orphan", order_by="ProgressUpdate.created_at"
    )
    workflow_events: Mapped[list["WorkflowEvent"]] = relationship(back_populates="agreement", cascade="all, delete-orphan")
    drive_permissions: Mapped[list["AgreementDrivePermission"]] = relationship(
        back_populates="agreement", cascade="all, delete-orphan", order_by="AgreementDrivePermission.granted_at"
    )

    @property
    def current_version(self) -> "AgreementVersion | None":
        """The most recent (non-superseded) version, derived from MAX(timestamp)."""
        if not self.versions:
            return None
        return max(self.versions, key=lambda v: v.timestamp)

    @property
    def days_to_expiry(self) -> int | None:
        if not self.end_date:
            return None
        return (self.end_date - date.today()).days


class AgreementVersion(Base):
    __tablename__ = "agreement_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    file: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(127), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    # Historical snapshot of Agreement.status at creation time — not a live join.
    status_at_time: Mapped[str] = mapped_column(String(40), nullable=False)
    is_final: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    agreement: Mapped[Agreement] = relationship(back_populates="versions")
    uploaded_by: Mapped["User"] = relationship()


class AgreementDrivePermission(Base):
    """Local record of a Drive permission grant — GOOGLE_DOCS_DRAFTING_BRIEF.md
    Section 4. Revocation always goes through the stored `permission_id`
    here, never a permissions.list lookup against the Drive API.
    """

    __tablename__ = "agreement_drive_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    # "researcher" | "partner" | "linkages" | "legal" — why the grant exists,
    # not the grantee's system role (see the brief for the distinction).
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    permission_id: Mapped[str] = mapped_column(String(120), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    agreement: Mapped[Agreement] = relationship(back_populates="drive_permissions")


class ProgressUpdate(Base):
    __tablename__ = "progress_updates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    quarter: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    submitted_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    agreement: Mapped[Agreement] = relationship(back_populates="progress_updates")
    submitted_by: Mapped["User"] = relationship()
