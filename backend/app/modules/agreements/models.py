"""Agreement domain models — REBUILD_BRIEF.md Section 2.6.

Agreement.status is the single authoritative workflow field (there is no
separate "stage" concept anymore). AgreementVersion, Comment and
ProgressUpdate are new tables that replace the old flat `Document` model.
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
    "pending_legal_review",
    "returned_for_corrections",
    "pending_legal_verification",
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
    champion_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="draft_generated", index=True, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Computed once, at the awaiting_signatures -> fully_executed transition (Phase 3 / Section 4.3).
    expiry_alert_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_notified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # NOTE: `archived` (bool) tracks M&E's terminal action distinctly from the
    # `status` enum for querying convenience; `status` remains authoritative.
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    partner: Mapped["Partner"] = relationship(back_populates="agreements")
    champion: Mapped["User"] = relationship(back_populates="owned_agreements", foreign_keys=[champion_id])
    versions: Mapped[list["AgreementVersion"]] = relationship(
        back_populates="agreement", cascade="all, delete-orphan", order_by="AgreementVersion.timestamp"
    )
    progress_updates: Mapped[list["ProgressUpdate"]] = relationship(
        back_populates="agreement", cascade="all, delete-orphan", order_by="ProgressUpdate.created_at"
    )
    workflow_events: Mapped[list["WorkflowEvent"]] = relationship(back_populates="agreement", cascade="all, delete-orphan")

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
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    # Historical snapshot of Agreement.status at creation time — not a live join.
    status_at_time: Mapped[str] = mapped_column(String(40), nullable=False)
    is_final: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    agreement: Mapped[Agreement] = relationship(back_populates="versions")
    uploaded_by: Mapped["User"] = relationship()
    comments: Mapped[list["Comment"]] = relationship(back_populates="version", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("agreement_versions.id"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)
    section_reference: Mapped[str | None] = mapped_column(String(300), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    version: Mapped[AgreementVersion] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship()


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
