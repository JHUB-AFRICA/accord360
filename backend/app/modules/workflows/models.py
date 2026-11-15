from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.timeutils import utc_now

# NOTE(rebuild-phase1): WorkflowEvent is reused (per REBUILD_BRIEF.md Section
# 1, "Do NOT remove") as the generic audit trail for Agreement.status
# transitions. `from_stage`/`to_stage` now hold *status* values (one of the
# nine strings in Section 2.2), not the old 17-stage concept — the column
# names are kept as-is to avoid an unnecessary migration/rename.
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


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(100), default="workflow.update", nullable=False)
    category: Mapped[str] = mapped_column(String(30), default="status_update", nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="info", nullable=False)
    # Legacy column retained for existing databases/clients; kept in lockstep with severity.
    level: Mapped[str] = mapped_column(String(30), default="info", nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    requires_action: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    dedupe_key: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    agreement_id: Mapped[int | None] = mapped_column(ForeignKey("agreements.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    actor: Mapped["User | None"] = relationship(foreign_keys=[actor_id])
    agreement: Mapped["Agreement | None"] = relationship()

    __table_args__ = (
        Index("ix_notifications_user_created_id", "user_id", "created_at", "id"),
        Index("ix_notifications_user_read_created", "user_id", "is_read", "created_at"),
        Index("ix_notifications_agreement_event_user", "agreement_id", "event_type", "user_id"),
    )

    @property
    def actor_name(self) -> str:
        return self.actor.full_name if self.actor else "System"

    @property
    def agreement_title(self) -> str | None:
        return self.agreement.title if self.agreement else None

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
