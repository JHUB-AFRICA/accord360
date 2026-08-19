from sqlalchemy.orm import DeclarativeBase

from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from app.timeutils import utc_now


class Base(DeclarativeBase):
    """Shared SQLAlchemy declarative base for all domain models."""


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now, nullable=False)
