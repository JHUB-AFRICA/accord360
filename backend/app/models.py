from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
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
    # BR-001: initiators/owners are Champions (JKUAT Champion). Partner-side
    # champions/liaisons are tracked on the agreement and partner records.
    role: Mapped[str] = mapped_column(String(40), default="champion", index=True)
    department: Mapped[str | None] = mapped_column(String(160), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    owned_agreements: Mapped[list["Agreement"]] = relationship(back_populates="owner", foreign_keys="Agreement.owner_id")


class Partner(Base, TimestampMixin):
    __tablename__ = "partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(240), unique=True, index=True, nullable=False)
    sector: Mapped[str] = mapped_column(String(120), nullable=False)
    partner_type: Mapped[str] = mapped_column(String(120), default="Institution")
    category: Mapped[str | None] = mapped_column(String(120), index=True)  # BR-003 partner category
    country: Mapped[str] = mapped_column(String(100), default="Kenya")
    county: Mapped[str | None] = mapped_column(String(100))
    contact_name: Mapped[str | None] = mapped_column(String(160))
    contact_email: Mapped[str | None] = mapped_column(String(200))
    legal_counterpart: Mapped[str | None] = mapped_column(String(200))
    liaison: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(40), default="active")

    agreements: Mapped[list["Agreement"]] = relationship(back_populates="partner")


class PartnerCategory(Base, TimestampMixin):
    """BR-003 / FR-007: configurable partner categories managed by administrators."""

    __tablename__ = "partner_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Template(Base, TimestampMixin):
    """BR-003 / FR-007-008: editable agreement templates by type and partner category."""

    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    agreement_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    partner_category: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[str] = mapped_column(String(30), default="1.0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class PartnerRequest(Base, TimestampMixin):
    """BR-002 / FR-004: partner-originated collaboration requests logged by Linkages.

    Drafting is blocked until an internal JKUAT Champion is assigned.
    """

    __tablename__ = "partner_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    partner_name: Mapped[str] = mapped_column(String(240), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(120))
    category: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str] = mapped_column(String(100), default="Kenya")
    county: Mapped[str | None] = mapped_column(String(100))
    collaboration_area: Mapped[str] = mapped_column(Text, nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(160))
    contact_email: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="logged", index=True)  # logged | champion_assigned | converted | declined
    champion_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    logged_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    agreement_id: Mapped[int | None] = mapped_column(ForeignKey("agreements.id"))

    champion: Mapped[User | None] = relationship(foreign_keys=[champion_id])
    logged_by: Mapped[User] = relationship(foreign_keys=[logged_by_id])


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
    source: Mapped[str] = mapped_column(String(30), default="champion")  # champion | partner
    partner_category: Mapped[str | None] = mapped_column(String(120))
    stage: Mapped[str] = mapped_column(String(80), default="initiation", index=True)
    status: Mapped[str] = mapped_column(String(80), default="draft", index=True)
    status_color: Mapped[str] = mapped_column(String(20), default="yellow")
    next_action: Mapped[str | None] = mapped_column(String(240))
    confidentiality: Mapped[str] = mapped_column(String(30), default="internal")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)  # JKUAT Champion (BR-001)
    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"), nullable=False)
    assigned_linkages_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    legal_reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    partner_request_id: Mapped[int | None] = mapped_column(ForeignKey("partner_requests.id"))
    template_id: Mapped[int | None] = mapped_column(ForeignKey("templates.id"))
    template_version: Mapped[str | None] = mapped_column(String(30))  # FR-008 version pin
    partner_liaison: Mapped[str | None] = mapped_column(String(160))  # partner-side Champion/Liaison
    effective_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    signing_date: Mapped[date | None] = mapped_column(Date)
    date_sent_vc: Mapped[date | None] = mapped_column(Date)
    date_sent_partner: Mapped[date | None] = mapped_column(Date)
    legal_review_started_at: Mapped[datetime | None] = mapped_column(DateTime)
    # BR-006 / FR-014..016 approval gate records
    legal_approved_at: Mapped[datetime | None] = mapped_column(DateTime)
    legal_approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    legal_approved_version: Mapped[str | None] = mapped_column(String(30))
    dvc_signed_at: Mapped[datetime | None] = mapped_column(DateTime)
    dvc_signed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    vc_submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime)
    qualitative_score: Mapped[int | None] = mapped_column(Integer)  # BR-009 qualitative 0-100
    qualitative_note: Mapped[str | None] = mapped_column(Text)

    owner: Mapped[User] = relationship(back_populates="owned_agreements", foreign_keys=[owner_id])
    partner: Mapped[Partner] = relationship(back_populates="agreements")
    linkages_officer: Mapped[User | None] = relationship(foreign_keys=[assigned_linkages_id])
    legal_reviewer: Mapped[User | None] = relationship(foreign_keys=[legal_reviewer_id])
    legal_approved_by: Mapped[User | None] = relationship(foreign_keys=[legal_approved_by_id])
    dvc_signed_by: Mapped[User | None] = relationship(foreign_keys=[dvc_signed_by_id])
    template: Mapped[Template | None] = relationship()
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

    @property
    def vc_gate(self) -> dict:
        """BR-006: prerequisites for VC package completion, exposed for the UI."""
        return {
            "legal_approved": self.legal_approved_at is not None,
            "dvc_signed": self.dvc_signed_at is not None,
            "vc_submitted": self.vc_submitted_at is not None,
        }


class ScorecardCriterion(Base, TimestampMixin):
    """BR-009 / Appendix B: adjustable partnership scorecard weights (must total 100)."""

    __tablename__ = "scorecard_criteria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    weight: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class FAQEntry(Base, TimestampMixin):
    """BR-008 / FR-034: FAQ knowledge base behind the guidance chatbot."""

    __tablename__ = "faq_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question: Mapped[str] = mapped_column(String(300), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    keywords: Mapped[str] = mapped_column(Text, default="")  # comma separated
    category: Mapped[str] = mapped_column(String(80), default="General")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class LegalFeedback(Base):
    """BR-004: threaded feedback between Legal, the Champion and Linkages on drafts."""

    __tablename__ = "legal_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    document_version: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    author: Mapped[User] = relationship()


class MEReportSchedule(Base, TimestampMixin):
    """BR-007 / FR-021..025: six-month reporting cycle for active agreements."""

    __tablename__ = "me_report_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    period_label: Mapped[str] = mapped_column(String(80), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)  # pending | submitted | validated | returned
    activities: Mapped[str | None] = mapped_column(Text)
    outcomes: Mapped[str | None] = mapped_column(Text)
    challenges: Mapped[str | None] = mapped_column(Text)
    evidence_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"))
    submitted_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    validated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    validated_at: Mapped[datetime | None] = mapped_column(DateTime)
    feedback: Mapped[str | None] = mapped_column(Text)
    alerted_at: Mapped[datetime | None] = mapped_column(DateTime)  # last due-date alert sent

    submitted_by: Mapped[User | None] = relationship(foreign_keys=[submitted_by_id])
    validated_by: Mapped[User | None] = relationship(foreign_keys=[validated_by_id])

    @property
    def days_to_due(self) -> int:
        return (self.due_date - date.today()).days

    @property
    def is_overdue(self) -> bool:
        return self.status in {"pending", "returned"} and self.due_date < date.today()


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
    checksum_sha256: Mapped[str | None] = mapped_column(String(64))  # FR-009
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    is_official: Mapped[bool] = mapped_column(Boolean, default=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)  # BR-005 version lock
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
