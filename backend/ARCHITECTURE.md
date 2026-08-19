# Accord 360 Backend Architecture

Accord 360 is a FastAPI backend for agreement lifecycle management, including
MoUs, CRAs, and CAs. The backend is organized by business capability while
keeping database infrastructure replaceable.

## Directory layout

```text
app/
├── main.py                         # FastAPI app, middleware, router composition
├── core/
│   ├── config.py                    # Environment-backed application settings
│   └── security.py                  # Password hashing and JWT operations
├── db/
│   ├── base.py                      # Declarative SQLAlchemy base and shared mixins
│   └── session.py                   # Engine, session factory, and get_db dependency
├── modules/
│   ├── users/
│   │   ├── router.py                # Login, current-user, and user administration endpoints
│   │   ├── schemas.py                # User and authentication Pydantic contracts
│   │   ├── models.py                 # User SQLAlchemy mapping
│   │   └── service.py                # User use-case helpers
│   ├── partners/
│   │   ├── router.py
│   │   ├── schemas.py
│   │   ├── models.py
│   │   └── service.py
│   ├── agreements/
│   │   ├── router.py                # Agreement lifecycle endpoints
│   │   ├── schemas.py                # Agreement and document contracts
│   │   ├── models.py                 # Agreement and document mappings
│   │   └── service.py
│   └── workflows/
│       ├── router.py                # Workflow router composition
│       ├── dashboard.py              # Role workspaces and dashboard endpoints
│       ├── documents.py              # Agreement document endpoints
│       ├── me.py                     # Monitoring and evaluation endpoints
│       ├── notifications.py
│       ├── reports.py
│       ├── schemas.py
│       ├── models.py                 # Workflow, M&E, notification, and audit mappings
│       └── service.py                # Transitions, SLA/risk rules, and notifications
└── utils/
    └── storage.py                    # S3-compatible object-storage adapter
```

## Request flow

1. `app/main.py` creates the FastAPI instance and includes feature routers under
   `/api`.
2. A router validates request data with a feature schema and receives a
   SQLAlchemy `Session` through `Depends(get_db)`.
3. Authorization dependencies in `app/deps.py` and `app/access.py` enforce
   authentication, roles, and agreement scope.
4. Feature services apply business rules and database queries using the session
   supplied by the router.
5. The router returns a Pydantic response schema.

Document bytes are stored in the configured S3-compatible bucket (MinIO in the
Docker Compose deployment). The
`documents` table stores the object key in `stored_name` plus the original
filename, MIME type, size, uploader, confidentiality, and lifecycle metadata.
Downloads stream bytes from object storage after the existing authorization
checks; object storage is never publicly mounted by FastAPI.

Routers and services must not create engines or sessions. Database creation is
isolated to `app/db/session.py`, so changing SQLite to PostgreSQL primarily
requires changing `DATABASE_URL` and database deployment/migration settings.

## Compatibility modules

The former top-level modules (`app.models`, `app.schemas`, `app.services`,
`app.database`, `app.security`, and `app.routers`) are intentionally retained
as thin re-export shims. They prevent breaking existing scripts, migrations,
and external imports while all application composition uses the new module
paths.

## Configuration

Important environment variables include:

- `DATABASE_URL`: defaults to `sqlite:///./accord360.db`; use a PostgreSQL URL
  for a managed database.
- `SECRET_KEY`: required to be non-development in production.
- `ENVIRONMENT`: use `test` for test database initialization.
- `SEED_DEMO_DATA`: controls demo users and agreements.
- `OBJECT_STORAGE_ENABLED`: enables S3-compatible object storage outside test environments.
- `AWS_ENDPOINT_URL_S3`: S3-compatible endpoint, such as `http://minio:9000` in Docker Compose.
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: object-storage credentials.
- `AWS_REGION`: storage region, normally `us-east-2` for the Docker Compose configuration.
- `AWS_BUCKET_NAME`: configured bucket, normally `accord-360`.
- `UPLOAD_DIR`: local fallback directory used by tests or when object storage is disabled.

## Local development

From the backend directory:

```bash
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
python -m pytest -q
```

The current test suite uses FastAPI `TestClient`. Run it with a supported Python
version for the pinned FastAPI/Starlette stack; the current Python 3.14
environment has a reproducible AnyIO synchronous threadpool hang even with a
minimal FastAPI application.
