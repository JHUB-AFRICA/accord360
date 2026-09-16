from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.timeutils import utc_now

class WorkflowEvent(Base):
    __tablename__ = "workflow_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    from_stage: Mapped[str | None] = mapped_column(String(80))
    to_stage: Mapped[str] = mapped_column(String(80), nullable=False)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    agreement: Mapped[Agreement] = relationship(back_populates="workflow_events")
    actor: Mapped[User] = relationship()


class Correction(Base, TimestampMixin):
    __tablename__ = "corrections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    workflow_event_id: Mapped[int] = mapped_column(ForeignKey("workflow_events.id"), nullable=False, unique=True)
    return_action: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True, nullable=False)
    exact_item: Mapped[str] = mapped_column(String(300), nullable=False)
    requested_change: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[str | None] = mapped_column(Text)
    requested_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    response_text: Mapped[str | None] = mapped_column(Text)
    responded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime)
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)

    agreement: Mapped[Agreement] = relationship()
    workflow_event: Mapped[WorkflowEvent] = relationship()
    requested_by: Mapped[User] = relationship(foreign_keys=[requested_by_id])
    assigned_to: Mapped[User | None] = relationship(foreign_keys=[assigned_to_id])
    responded_by: Mapped[User | None] = relationship(foreign_keys=[responded_by_id])
    resolved_by: Mapped[User | None] = relationship(foreign_keys=[resolved_by_id])

    @property
    def agreement_reference(self) -> str:
        return self.agreement.reference_number

    @property
    def agreement_title(self) -> str:
        return self.agreement.title

    @property
    def partner_name(self) -> str:
        return self.agreement.partner.name

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
    last_updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

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


class ScorecardDefinition(Base, TimestampMixin):
    __tablename__ = "scorecard_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    version: Mapped[str] = mapped_column(String(30), nullable=False)
    weights_json: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    created_by: Mapped[User | None] = relationship()


class ScorecardSnapshot(Base):
    __tablename__ = "scorecard_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    definition_id: Mapped[int] = mapped_column(ForeignKey("scorecard_definitions.id"), nullable=False)
    overall: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    components_json: Mapped[str] = mapped_column(Text, nullable=False)
    source_updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    calculated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    agreement: Mapped[Agreement] = relationship()
    definition: Mapped[ScorecardDefinition] = relationship()
    calculated_by: Mapped[User | None] = relationship(foreign_keys=[calculated_by_id])

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    level: Mapped[str] = mapped_column(String(30), default="info")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    agreement_id: Mapped[int | None] = mapped_column(ForeignKey("agreements.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    actor: Mapped[User | None] = relationship()
