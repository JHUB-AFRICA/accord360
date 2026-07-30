from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Accord 360")
    environment: str = os.getenv("ENVIRONMENT", "development").strip().lower()
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change-me-use-at-least-32-characters")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./accord360.db")
    upload_dir: str = os.getenv("UPLOAD_DIR", "uploads")
    seed_demo_data: bool = env_bool("SEED_DEMO_DATA", True)
    cors_origins: tuple[str, ...] = tuple(
        item.strip()
        for item in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if item.strip()
    )

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def validate(self) -> None:
        if self.is_production and self.secret_key.startswith("dev-secret"):
            raise RuntimeError("A secure SECRET_KEY must be configured in production")
        if self.is_production and self.seed_demo_data:
            raise RuntimeError("SEED_DEMO_DATA must be false in production")


settings = Settings()
