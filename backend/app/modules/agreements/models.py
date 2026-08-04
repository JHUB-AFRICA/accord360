from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.timeutils import utc_now

class Agreement(Base, TimestampMixin):
    __tablename__ = "agreements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference_number: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    agreement_type: Mapped[str] = mapped_column(String(30), nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    expected_outcomes: Mapped[str | None] = mapped_column(Text)
    strategic_alignment: Mapped[str | None] = mapped_column(String(200))
    department: Mapped[str] = mapped_column(String(180), nullable=False)
    stage: Mapped[str] = mapped_column(String(80), default="initiation", index=True)
    status: Mapped[str] = mapped_column(String(80), default="draft", index=True)
    status_color: Mapped[str] = mapped_column(String(20), default="yellow")
    next_action: Mapped[str | None] = mapped_column(String(240))
    confidentiality: Mapped[str] = mapped_column(String(30), default="internal")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"), nullable=False)
    assigned_approver_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    assigned_linkages_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    legal_reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    internal_champion: Mapped[str | None] = mapped_column(String(160))
    partner_liaison: Mapped[str | None] = mapped_column(String(160))
    effective_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    signing_date: Mapped[date | None] = mapped_column(Date)
    date_sent_vc: Mapped[date | None] = mapped_column(Date)
    date_sent_partner: Mapped[date | None] = mapped_column(Date)
    legal_review_started_at: Mapped[datetime | None] = mapped_column(DateTime)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime)

    owner: Mapped[User] = relationship(back_populates="owned_agreements", foreign_keys=[owner_id])
    partner: Mapped[Partner] = relationship(back_populates="agreements")
    approver: Mapped[User | None] = relationship(foreign_keys=[assigned_approver_id])
    linkages_officer: Mapped[User | None] = relationship(foreign_keys=[assigned_linkages_id])
    legal_reviewer: Mapped[User | None] = relationship(foreign_keys=[legal_reviewer_id])
    documents: Mapped[list["Document"]] = relationship(back_populates="agreement", cascade="all, delete-orphan")
    workflow_events: Mapped[list["WorkflowEvent"]] = relationship(back_populates="agreement", cascade="all, delete-orphan")
    deliverables: Mapped[list["Deliverable"]] = relationship(back_populates="agreement", cascade="all, delete-orphan")
    values: Mapped[list["ValueRecord"]] = relationship(back_populates="agreement", cascade="all, delete-orphan")

    @property
    def legal_review_days(self) -> int | None:
        if not self.legal_review_started_at:
            return None
        return max(0, (utc_now() - self.legal_review_started_at).days)

    @property
    def days_to_expiry(self) -> int | None:
        if not self.expiry_date:
            return None
        return (self.expiry_date - date.today()).days

class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(80), default="supporting")
    version: Mapped[str] = mapped_column(String(30), default="1.0")
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    is_official: Mapped[bool] = mapped_column(Boolean, default=False)
    confidentiality: Mapped[str] = mapped_column(String(30), default="internal")

    agreement: Mapped[Agreement] = relationship(back_populates="documents")
    uploaded_by: Mapped[User] = relationship()
