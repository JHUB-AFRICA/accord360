"""Backward-compatible import location; use :mod:`app.core.config`."""

from .core.config import Settings, env_bool, settings

__all__ = ["Settings", "env_bool", "settings"]
