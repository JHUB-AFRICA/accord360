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
    email_enabled: bool = env_bool("EMAIL_ENABLED", False)
    email_provider: str = os.getenv("EMAIL_PROVIDER", "console").strip().lower()
    email_from: str = os.getenv("EMAIL_FROM", "notifications@example.com")
    email_from_name: str = os.getenv("EMAIL_FROM_NAME", "Accord 360")
    smtp_host: str | None = os.getenv("SMTP_HOST") or None
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_username: str | None = os.getenv("SMTP_USERNAME") or None
    smtp_password: str | None = os.getenv("SMTP_PASSWORD") or None
    smtp_use_tls: bool = env_bool("SMTP_USE_TLS", True)
    smtp_use_ssl: bool = env_bool("SMTP_USE_SSL", False)
    smtp_timeout_seconds: int = int(os.getenv("SMTP_TIMEOUT_SECONDS", "10"))
    resend_api_key: str | None = os.getenv("RESEND_API_KEY") or None
    resend_api_url: str = os.getenv("RESEND_API_URL", "https://api.resend.com/emails")
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
        if self.email_provider not in {"console", "smtp", "resend"}:
            raise RuntimeError("EMAIL_PROVIDER must be one of: console, smtp, resend")
        if self.email_enabled and self.email_provider == "smtp" and not self.smtp_host:
            raise RuntimeError("SMTP_HOST is required when SMTP email is enabled")
        if self.email_enabled and self.email_provider == "resend" and not self.resend_api_key:
            raise RuntimeError("RESEND_API_KEY is required when EMAIL_PROVIDER=resend")
        if self.email_enabled and self.email_provider == "smtp" and self.smtp_use_tls and self.smtp_use_ssl:
            raise RuntimeError("SMTP_USE_TLS and SMTP_USE_SSL cannot both be true")


settings = Settings()


def sqlalchemy_database_url(url: str) -> str:
    """Use the psycopg 3 driver for generic PostgreSQL URLs."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url
