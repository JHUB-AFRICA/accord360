from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(40), default="researcher", index=True)
    department: Mapped[str | None] = mapped_column(String(160), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    owned_agreements: Mapped[list["Agreement"]] = relationship(back_populates="owner", foreign_keys="Agreement.owner_id")


class Partner(Base, TimestampMixin):
    __tablename__ = "partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(240), unique=True, index=True, nullable=False)
    sector: Mapped[str] = mapped_column(String(120), nullable=False)
    partner_type: Mapped[str] = mapped_column(String(120), default="Institution")
    country: Mapped[str] = mapped_column(String(100), default="Kenya")
    contact_name: Mapped[str | None] = mapped_column(String(160))
    contact_email: Mapped[str | None] = mapped_column(String(200))
    legal_counterpart: Mapped[str | None] = mapped_column(String(200))
    liaison: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(40), default="active")

    agreements: Mapped[list["Agreement"]] = relationship(back_populates="partner")


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
    def days_in_stage(self) -> int:
        anchor = self.legal_review_started_at if self.stage == "legal_review" and self.legal_review_started_at else self.updated_at
        return max(0, (datetime.utcnow() - anchor).days) if anchor else 0

    @property
    def sla_target_days(self) -> int | None:
        # Only the 21-day legal threshold is formally defined in the validated baseline.
        return 21 if self.stage == "legal_review" else None

    @property
    def sla_state(self) -> str:
        if self.status_color == "red":
            return "breached"
        if self.status_color == "orange":
            return "warning"
        if self.sla_target_days is None:
            return "not_configured"
        if self.days_in_stage >= self.sla_target_days:
            return "breached"
        if self.days_in_stage >= max(1, self.sla_target_days - 5):
            return "warning"
        return "within_sla"

    @property
    def expiry_days(self) -> int | None:
        return (self.expiry_date - date.today()).days if self.expiry_date else None


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


class WorkflowEvent(Base):
    __tablename__ = "workflow_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    from_stage: Mapped[str | None] = mapped_column(String(80))
    to_stage: Mapped[str] = mapped_column(String(80), nullable=False)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    agreement: Mapped[Agreement] = relationship(back_populates="workflow_events")
    actor: Mapped[User] = relationship()


class Deliverable(Base, TimestampMixin):
    __tablename__ = "deliverables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    deliverable_type: Mapped[str] = mapped_column(String(120), nullable=False)
    target_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    actual_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    reporting_period: Mapped[str | None] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text)
    evidence_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"))
    last_updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agreement: Mapped[Agreement] = relationship(back_populates="deliverables")


class ValueRecord(Base, TimestampMixin):
    __tablename__ = "value_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    value_type: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="KES")
    source: Mapped[str | None] = mapped_column(String(200))
    reporting_period: Mapped[str | None] = mapped_column(String(80))
    approved: Mapped[bool] = mapped_column(Boolean, default=True)

    agreement: Mapped[Agreement] = relationship(back_populates="values")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    level: Mapped[str] = mapped_column(String(30), default="info")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    agreement_id: Mapped[int | None] = mapped_column(ForeignKey("agreements.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    object_type: Mapped[str] = mapped_column(String(80), nullable=False)
    object_id: Mapped[str] = mapped_column(String(80), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    source_ip: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    actor: Mapped[User | None] = relationship()
