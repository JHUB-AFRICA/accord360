from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
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


class PartnerApplication(Base, TimestampMixin):
    __tablename__ = "partner_applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference_number: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    institution_name: Mapped[str] = mapped_column(String(240), nullable=False)
    institution_type: Mapped[str] = mapped_column(String(120), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[str | None] = mapped_column(String(120))
    website: Mapped[str] = mapped_column(String(300), nullable=False)
    registration_number: Mapped[str | None] = mapped_column(String(160))
    contact_name: Mapped[str] = mapped_column(String(160), nullable=False)
    job_title: Mapped[str] = mapped_column(String(160), nullable=False)
    official_email: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(60), nullable=False)
    collaboration_area: Mapped[str] = mapped_column(Text, nullable=False)
    strategic_alignment: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending_email_verification", index=True, nullable=False)
    consent_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime)
    verification_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    verification_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    review_notes: Mapped[str | None] = mapped_column(Text)

    documents: Mapped[list["PartnerApplicationDocument"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )


class PartnerApplicationDocument(Base):
    __tablename__ = "partner_application_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("partner_applications.id"), nullable=False, index=True)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    application: Mapped[PartnerApplication] = relationship(back_populates="documents")
