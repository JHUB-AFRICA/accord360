from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

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
    review_events: Mapped[list["PartnerReviewEvent"]] = relationship(
        back_populates="partner", cascade="all, delete-orphan", order_by="PartnerReviewEvent.created_at.desc()"
    )


class PartnerReviewEvent(Base):
    __tablename__ = "partner_review_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"), nullable=False, index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    old_status: Mapped[str | None] = mapped_column(String(40))
    new_status: Mapped[str] = mapped_column(String(40), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    partner: Mapped[Partner] = relationship(back_populates="review_events")
    reviewer: Mapped["User"] = relationship()
