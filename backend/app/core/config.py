from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


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
    object_storage_enabled: bool = env_bool("OBJECT_STORAGE_ENABLED", False)
    storage_endpoint_url: str | None = os.getenv("AWS_ENDPOINT_URL_S3")
    storage_access_key_id: str | None = os.getenv("AWS_ACCESS_KEY_ID")
    storage_secret_access_key: str | None = os.getenv("AWS_SECRET_ACCESS_KEY")
    storage_region: str = os.getenv("AWS_REGION", "us-east-2")
    storage_bucket: str = os.getenv("AWS_BUCKET_NAME", "accord-360")
    seed_demo_data: bool = env_bool("SEED_DEMO_DATA", True)
    log_level: str = os.getenv("LOG_LEVEL", "INFO").strip().upper()
    cors_origins: tuple[str, ...] = tuple(
        item.strip() for item in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",") if item.strip()
    )

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def storage_enabled(self) -> bool:
        # Keep tests isolated from the deployed object store unless explicitly enabled.
        return self.object_storage_enabled and self.environment != "test"

    def validate(self) -> None:
        if self.is_production and self.secret_key.startswith("dev-secret"):
            raise RuntimeError("A secure SECRET_KEY must be configured in production")
        if self.is_production and self.seed_demo_data:
            raise RuntimeError("SEED_DEMO_DATA must be false in production")
        if self.object_storage_enabled and not all(
            (self.storage_endpoint_url, self.storage_access_key_id, self.storage_secret_access_key, self.storage_bucket)
        ):
            raise RuntimeError("Complete S3-compatible object-storage settings are required when enabled")


settings = Settings()


def sqlalchemy_database_url(url: str) -> str:
    """Use the psycopg 3 driver for generic PostgreSQL URLs."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url
