from __future__ import annotations

from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return a naive UTC datetime for consistent SQLite/PostgreSQL storage."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
