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
    # Open self-service signup (email + office, no verification). Demos only.
    allow_demo_signup: bool = env_bool("ALLOW_DEMO_SIGNUP", False)
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
    google_drive_enabled: bool = env_bool("GOOGLE_DRIVE_ENABLED", False)
    google_service_account_json: str | None = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON") or None
    # Optional Drive folder (shared with the service account as Editor) that
    # template copies are created in.
    google_drive_folder_id: str | None = os.getenv("GOOGLE_DRIVE_FOLDER_ID") or None
    # Demo-only trade-off: a bare service account has no Drive storage quota
    # of its own, so files.copy fails until a real Shared Drive is available
    # (see GOOGLE_DOCS_DRAFTING_BRIEF.md's open items). Until then, set this
    # to a Doc the service account already has Editor on (a hand-made copy of
    # the master, NOT the master itself) and copy_template() reuses it instead
    # of calling files.copy. grant_permission/revoke_permission still hit the
    # real Drive API, so sharing/removal behavior is genuinely exercised.
    # Remove this once a Shared Drive is set up and real copying works.
    google_drive_demo_doc_id: str | None = os.getenv("GOOGLE_DRIVE_DEMO_DOC_ID") or None
    # Minutes between sweeps that strip Drive access the workflow did not
    # grant (shares added by hand inside Google Docs). 0 disables the job.
    drive_access_sweep_minutes: int = int(os.getenv("DRIVE_ACCESS_SWEEP_MINUTES", "2"))
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
        if self.google_drive_enabled and not self.google_service_account_json:
            raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is required when Google Drive integration is enabled")
        if self.google_drive_demo_doc_id and self.is_production:
            raise RuntimeError("GOOGLE_DRIVE_DEMO_DOC_ID must not be set in production")


settings = Settings()


def sqlalchemy_database_url(url: str) -> str:
    """Use the psycopg 3 driver for generic PostgreSQL URLs."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
        relative_path = url.removeprefix("sqlite:///")
        if relative_path.startswith("./"):
            relative_path = relative_path[2:]
        backend_root = Path(__file__).resolve().parents[2]
        return f"sqlite:///{(backend_root / relative_path).resolve()}"
    return url
