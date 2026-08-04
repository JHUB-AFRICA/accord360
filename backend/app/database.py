
"""Backward-compatible import location; use :mod:`app.db` instead."""

from .db.base import Base
from .db.session import SessionLocal, engine, get_db

__all__ = ["Base", "SessionLocal", "engine", "get_db"]
