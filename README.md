# Accord 360 — JKUAT Linkages Agreement Lifecycle Platform

Accord 360 is a responsive MoU / CRA / CA workflow and partnership-performance application for the JKUAT Directorate of Linkages. Version 1.2 introduces complete role-based routing and workspaces: users share one secure institutional platform, but they do not enter the same operational dashboard or receive the same actions.

## Run with Docker

From the project root:

```bash
docker compose up --build
```

Open:

- Website: `http://localhost:8080`
- API documentation: `http://localhost:8000/docs`
- API health: `http://localhost:8000/health`

## Run locally on Windows

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

Frontend in a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Database configuration and migrations

The backend loads database configuration from `backend/.env`. SQLite works by
default. To use Neon, copy `backend/.env.example` to `backend/.env` and replace
`DATABASE_URL` with the SQLAlchemy-compatible connection string from Neon:

```dotenv
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

Keep `.env` private; it is excluded from Git. Apply all schema migrations before
starting the API:

```bash
cd backend
python -m alembic upgrade head
```

After changing SQLAlchemy models, create and review a migration, then apply it:

```bash
python -m alembic revision --autogenerate -m "describe schema change"
python -m alembic upgrade head
```

## Demo role accounts

Run `python -m app.seed --reset` from the `backend` directory to recreate all demo users and role-specific queue records.

| Workspace | Email | Password |
|---|---|---|
| System Administrator | `admin@accord360.app` | `Admin@123` |
| JKUAT Champion | `researcher@accord360.app` | `Research@123` |
| Department / Faculty Approver | `approver@accord360.app` | `Approver@123` |
| Linkages Officer | `linkages@accord360.app` | `Linkages@123` |
| Director, Linkages | `director.linkages@accord360.app` | `Director@123` |
| Legal Office Reviewer | `legal@accord360.app` | `Legal@123` |
| DVC RPE | `dvc.rpe@accord360.app` | `DvcRpe@123` |
| VC Office | `vc.office@accord360.app` | `VcOffice@123` |
| M&E Officer | `me@accord360.app` | `Measure@123` |
| Executive Viewer | `executive@accord360.app` | `Executive@123` |
| Auditor | `auditor@accord360.app` | `Auditor@123` |

Do not deploy the demo credentials. Set `SEED_DEMO_DATA=false`, change `SECRET_KEY`, configure institutional accounts/SSO and remove or deactivate all demo users before production use.

## Role-based behavior

After successful authentication, the frontend reads the user's role returned by the API and redirects to the appropriate workspace:

```text
researcher         → /champion
approver           → /approvals
linkages           → /linkages
director_linkages  → /linkages
legal              → /legal
dvc                → /dvc
vc_office          → /signing
me                 → /monitoring
executive          → /executive
admin              → /admin
auditor            → /audit-workspace
```

Each role receives its own navigation, KPI definitions, action queue, guidance and route permissions. Backend authorization independently enforces record scope and workflow actions, so manually calling a hidden endpoint does not bypass security.

See `docs/ROLE_BASED_WORKSPACES.md` for the full access matrix.

## Governed lifecycle

```text
Initiation
→ Department / Faculty Approval
→ Linkages Review
→ Legal Review
→ DVC RPE Endorsement
→ VC Submission
→ VC / Partner Signing
→ Active Implementation
→ Renewal / Closure
→ Archive
```

Key controls include:

- Legal approval cannot be performed by Linkages, DVC, VC Office or administrators.
- DVC endorsement cannot occur before Legal approval.
- Linkages cannot submit a package to VC Office before DVC endorsement.
- VC Office can track signatures but cannot alter earlier approvals.
- Administrators manage access and configuration but cannot forge business approvals.
- Executives and auditors are read-only.
- Agreement lists, dashboards, reports and document downloads are scoped on the server.

## JKUAT visual design

The portal uses the requested JKUAT-aligned green palette:

```css
--primary: #96be4c;
--primary-dark: #6f9135;
--sidebar: #153f28;
```

The login page does not expose or pre-fill demo credentials.

## Testing

From `backend`:

```powershell
$env:PYTHONPATH="."
pytest -q
```

Current automated result: **10 tests passed**, including role workspace definitions and an end-to-end workflow test proving that each approval is restricted to the correct role.

## Project structure

```text
Accord360_Role_Based_Final_Project/
├── backend/
│   ├── app/
│   ├── tests/
│   ├── uploads/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── lib/
│   │   └── pages/
│   └── package.json
├── docs/
├── docker-compose.yml
├── start-local.bat
├── start-local.sh
└── README.md
```
