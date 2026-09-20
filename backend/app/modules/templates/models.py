from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.timeutils import utc_now


class Template(Base):
    """Document templates — REBUILD_BRIEF.md Section 2.6.

    INVARIANT: at most one Template per document_type has is_active=true.
    Activating one must atomically deactivate any other active Template of
    the same document_type in the same transaction (see
    app.modules.templates.service.activate_template). Templates are never
    hard-deleted; "deactivating" is the only removal path.
    """

    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    file: Mapped[str] = mapped_column(String(500), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    uploaded_by: Mapped["User"] = relationship()


class FieldDefinition(Base):
    """Single source of truth for the Researcher's structured form fields and
    the {{tag}} placeholders checked during template validation (Phase 2).
    """

    __tablename__ = "field_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(240), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
