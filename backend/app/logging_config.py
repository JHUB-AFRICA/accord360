from __future__ import annotations

import logging
import logging.config
import os


def configure_logging() -> None:
    """Configure safe, human-readable console logging for local and deployed runs."""
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    if level not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
        level = "INFO"

    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
                    "datefmt": "%Y-%m-%dT%H:%M:%S%z",
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "level": level,
                    "formatter": "default",
                    "stream": "ext://sys.stdout",
                }
            },
            "root": {"level": level, "handlers": ["console"]},
            "loggers": {
                "uvicorn": {"level": level, "handlers": ["console"], "propagate": False},
                "uvicorn.error": {"level": level, "handlers": ["console"], "propagate": False},
                "uvicorn.access": {"level": "WARNING", "handlers": ["console"], "propagate": False},
            },
        }
    )
