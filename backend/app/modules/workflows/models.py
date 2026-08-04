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
