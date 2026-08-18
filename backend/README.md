# Accord 360 backend

Accord 360 is a FastAPI backend for managing institutional agreements and
partnerships at the JKUAT Directorate of Linkages. It supports the lifecycle of
MoUs, CRAs and CAs from initiation and review through approval, signing,
implementation, monitoring and closure.

The API is designed around server-side authorization: the user's role and the
agreement's workflow stage determine which records and actions are available.
The frontend is a client of this API; it is not the security boundary.

## What the backend does

- Authenticates users with JWT bearer tokens.
- Applies role and agreement-scope permissions for every protected operation.
- Manages users, partners, agreements, workflow transitions and approvals.
- Stores agreement documents either in local persistent storage or an
  S3-compatible object store.
- Provides role workspaces, dashboards, notifications, reports and audit data.
- Uses SQLAlchemy models with Alembic migrations, supporting SQLite locally and
  PostgreSQL in the containerized/deployed environment.

## System overview

The supplied diagrams provide the quickest visual introduction to the system:

![System architecture](docs/system%20architecture.svg)

![Request/response lifecycle](docs/request%20response%20life%20cycle.svg)

![Agreement workflow](docs/systemworkflow.pdf)

![Use cases](docs/use%20case%20diagram.svg)

The request path is:

```text
Client → FastAPI router → authentication/authorization dependencies
       → feature service → SQLAlchemy session → database
       → Pydantic response → client
```

Document bytes follow a separate path. The API first checks authorization,
then reads or writes the configured storage adapter. The database stores the
document metadata and object key; object storage is never publicly mounted by
the API.

## Project layout

```text
backend/
├── app/
│   ├── main.py                 # FastAPI app, middleware and router composition
│   ├── core/                   # Settings and security primitives
│   ├── db/                     # SQLAlchemy base, engine and session dependency
│   ├── modules/
│   │   ├── users/              # Login and user administration
│   │   ├── partners/           # Partner records
│   │   ├── agreements/         # Agreement lifecycle and documents
│   │   └── workflows/          # Dashboards, transitions, M&E and reports
│   └── utils/storage.py        # Local/S3-compatible document storage adapter
├── migrations/                 # Alembic migration history
├── tests/                      # Smoke, workflow and contract tests
├── docs/                       # Architecture and workflow diagrams
├── Dockerfile
├── requirements.txt
└── API_ENDPOINTS.md            # Implemented API contract
```

## Run locally with SQLite

Python 3.13 is the supported development version for the pinned dependency
stack.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
cp .env.example .env           # Windows: copy .env.example .env
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

The API is then available at `http://127.0.0.1:8000`.

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- Health endpoint: `http://127.0.0.1:8000/health`
- API routes: `http://127.0.0.1:8000/api`

## Run with Docker Compose

To run the backend with its own lightweight PostgreSQL container, from this
directory:

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build
```

The Compose stack starts PostgreSQL, MinIO, a one-time MinIO bucket
initializer, and the backend on the same private network. The backend connects
using the service hostnames `database` and `minio` (not `localhost`) and:

1. Installs the pinned Python dependencies.
2. Waits for PostgreSQL and MinIO to become healthy.
3. Creates the `accord-360` bucket automatically if it does not exist.
4. Runs `alembic upgrade head` before serving traffic.
5. Starts Uvicorn on `0.0.0.0:8000`.
6. Seeds demo users and agreements when `SEED_DEMO_DATA=true`.
7. Stores uploaded documents in the named `accord360_minio` volume through
   MinIO's S3-compatible API.

Changed storage setup:

- MinIO replaces the previously configured Neon S3-compatible bucket for the
  Docker Compose deployment.
- MinIO's S3 API is available at `http://127.0.0.1:9000`.
- The MinIO web console is available at `http://127.0.0.1:9001`.
- The `minio-init` service creates the bucket automatically, so no manual
  bucket setup is needed for a fresh Compose deployment.
- Change `MINIO_ROOT_PASSWORD` in `.env.docker` before sharing or deploying.
- The `accord360_minio` volume must be backed up in environments where
  uploaded documents need to survive host or disk failure.

The database and object storage are persisted in the named
`accord360_postgres` and `accord360_minio` volumes. Verify the complete
API-to-database and object-storage-backed application with:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"healthy","environment":"development","database":"connected"}
```

If a frontend is running on port 5173 or 8080, add its origin to
`CORS_ORIGINS` in `.env.docker`. The existing project-level Compose file can
still run the frontend and use the same backend/database arrangement.

PostgreSQL data is persisted in `accord360_postgres`, and MinIO data is
persisted in `accord360_minio`. Both services are health-checked before the
backend starts. Stop the stack with:

```bash
docker compose down
```

Use `docker compose down -v` only when intentionally removing the local
database and uploaded-file volumes.

## Configuration

Settings are read from environment variables. `.env.example` documents the
available values; never commit real credentials.

| Variable | Purpose | Development default |
| --- | --- | --- |
| `ENVIRONMENT` | Runtime mode and production safety checks | `development` |
| `SECRET_KEY` | JWT signing key | Development placeholder |
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite:///./accord360.db` |
| `UPLOAD_DIR` | Local upload directory | `uploads` |
| `OBJECT_STORAGE_ENABLED` | Enable S3-compatible document storage | `false` |
| `AWS_ENDPOINT_URL_S3` | S3-compatible endpoint | unset |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Storage credentials | unset |
| `AWS_REGION` / `AWS_BUCKET_NAME` | Storage location and bucket | `us-east-2` / `accord-360` |
| `SEED_DEMO_DATA` | Create demo users and records at startup | `true` |
| `CORS_ORIGINS` | Comma-separated allowed browser origins | localhost origins |
| `LOG_LEVEL` | Application log level | `INFO` |

For production, use a strong secret, PostgreSQL, managed object storage,
`ENVIRONMENT=production`, and `SEED_DEMO_DATA=false`. The application refuses
to start in production with the development secret or demo seeding enabled.

## Database migrations

Migrations are versioned in `migrations/versions` and are applied automatically
by the Docker entrypoint. For local development:

```bash
python -m alembic upgrade head
python -m alembic current
```

After changing models, review an autogenerated migration before applying it:

```bash
python -m alembic revision --autogenerate -m "describe schema change"
python -m alembic upgrade head
```

Do not use `Base.metadata.create_all()` as a production migration strategy.

## API and workflow

All business routes are under `/api`; `/health` and `/` are public operational
routes. Protected requests use:

```http
Authorization: Bearer <access_token>
```

The implemented endpoint contract is documented in
[`API_ENDPOINTS.md`](API_ENDPOINTS.md). The architecture notes in
[`ARCHITECTURE.md`](ARCHITECTURE.md) explain module responsibilities and
request flow in more detail.

The principal workflow is:

```text
Initiation → Department approval → Linkages review → Legal review
→ DVC RPE endorsement → VC submission → Signing → Active implementation
→ Renewal or closure → Archive
```

Workflow transitions are validated on the server. A UI control being hidden is
not sufficient to authorize an action.

## Tests

Run the backend test suite from this directory:

```bash
ENVIRONMENT=test DATABASE_URL=sqlite:///./test_accord360.db \
  PYTHONPATH=. python -m pytest -q
```

The tests use isolated SQLite databases and local upload directories. They
cover smoke behavior, role workspaces, the agreement approval lifecycle and
frontend/backend contract alignment.

## Demo accounts

Demo accounts are useful for a presentation environment when
`SEED_DEMO_DATA=true`. The credentials are listed in the project-level README.
They must not be used in production. Disable demo seeding and provision real
accounts before deployment.

## Operational notes

- Logs include a request ID; clients may supply `X-Request-ID` for tracing.
- The container runs as an unprivileged `appuser`.
- The image healthcheck calls `/health` on port 8000.
- The image intentionally excludes local databases, uploads, tests and docs;
  diagrams remain repository documentation rather than runtime dependencies.
- Keep document storage persistent. Without a volume or object storage,
  container-local uploads disappear when the container is recreated.
