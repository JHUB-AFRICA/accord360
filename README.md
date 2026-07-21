# Accord 360

**Accord 360** is a responsive MoU / CRA / CA lifecycle and partnership performance management system for the JKUAT Directorate of Linkages.

It includes:

- React + Vite responsive frontend
- FastAPI backend with interactive Swagger documentation
- SQLite for local development and PostgreSQL through Docker Compose
- JWT authentication and role-based access control
- Agreement request, review, signing, activation, M&E, renewal and archive workflow
- Partner registry
- Document upload and authenticated, controlled file repository
- Role-specific dashboards, priority work queues and executive Recharts visualizations
- CSV reporting
- Notifications and audit logging
- Demo users and demo portfolio records
- Desktop, tablet and mobile layouts with overflow protection


## Supervisor-baseline improvements

The current package includes the first improvement batch from the stakeholder validation briefing:

- Role-specific channels for Researchers, Approvers, Linkages, Legal, Executives, M&E, Auditors and Administrators
- Eight-stage lifecycle visualization and stage timers
- Legal SLA, expiry, renewal and dormancy guardrails
- Dedicated M&E portfolio workspace with evidence visibility
- Secure authenticated document downloads and role-scoped exports
- Required decision reasons for returns and rejections

See `IMPROVEMENTS_V2.md` for the complete change list.

## 1. Fastest way to run it

### Option A: Docker Desktop

From the project root:

```bash
docker compose up --build
```

Open:

- Website: `http://localhost:8080`
- API documentation: `http://localhost:8000/docs`
- API health: `http://localhost:8000/health`

Docker uses PostgreSQL and persistent volumes for the database and uploaded documents.

### Option B: Local Windows development

#### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Backend URLs:

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

#### Frontend

Open a second PowerShell window:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

After installing dependencies once, you can also double-click `start-local.bat` from the project root.

## 2. Demo accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@accord360.app` | `Admin@123` |
| Researcher | `researcher@accord360.app` | `Research@123` |
| Faculty approver | `approver@accord360.app` | `Approver@123` |
| Linkages officer | `linkages@accord360.app` | `Linkages@123` |
| Legal reviewer | `legal@accord360.app` | `Legal@123` |
| Executive | `executive@accord360.app` | `Executive@123` |
| M&E officer | `me@accord360.app` | `Measure@123` |

**Change all demo passwords and the `SECRET_KEY` before deployment.**

## 3. Main workflow

```text
Initiation
→ Department / Faculty Approval
→ Linkages Review
→ Drafting & Legal Review
→ Validation & Signing
→ Activation
→ Monitoring & Evaluation
→ Renewal / Closure / Archive
```

Workflow actions are controlled by both the user's role and the agreement's current stage.

## 4. Main features

### Authentication and access

- JWT login
- Current-user endpoint
- Account activation/deactivation
- Roles: admin, researcher, approver, linkages, legal, executive, M&E and auditor
- Researcher records are scoped to their own requests
- Legal and approver workspaces are scoped to relevant records

### Agreement management

- Unique reference numbers
- MoU, CRA, CA and configurable `Other` type
- Partner, department, purpose, expected outcomes and strategic alignment
- Signing and activation fields
- Status colors: green, yellow, orange and red
- Controlled workflow transitions and comments
- Complete workflow history

### File storage

- Upload PDF, Word, Excel, CSV, images and text files
- 25 MB maximum per file
- File type, version, confidentiality and official-version metadata
- Local upload directory in development
- Persistent Docker volume in container deployment

### Monitoring and evaluation

- Internal champion and partner liaison
- Deliverable targets and actuals
- Reporting periods
- Value generated records
- M&E progress visualization

### Dashboard and reports

- Active partnerships
- Pipeline volume
- Dormant / at-risk count
- Total value generated
- Charts by agreement type, workflow stage and monthly volume
- CSV agreement register export
- Audit report for authorized roles

## 5. Database reset and demo data

From `backend`:

Reset the database and restore demo data:

```powershell
python -m app.seed --reset
```

Reset and keep only the demo user accounts, without demo agreements:

```powershell
python -m app.seed --reset --empty
```

For SQLite, you can also delete `backend/accord360.db` and restart the backend.

## 6. Environment configuration

Copy the examples:

```powershell
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Important backend variables:

```text
SECRET_KEY
DATABASE_URL
UPLOAD_DIR
CORS_ORIGINS
ACCESS_TOKEN_EXPIRE_MINUTES
```

The included application reads environment variables directly. In PowerShell, set them before starting the server or use Docker Compose.

## 7. Project structure

```text
accord360/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── deps.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   ├── seed.py
│   │   └── services.py
│   ├── tests/
│   ├── uploads/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docs/
├── docker-compose.yml
├── start-local.bat
└── TESTING_CHECKLIST.md
```

## 8. Tests already included

Backend smoke tests verify:

- Administrator login
- Authenticated dashboard access
- Partner creation
- Agreement creation and reference generation

Run them from `backend`:

```powershell
$env:PYTHONPATH="."
pytest -q
```

Frontend production build:

```powershell
cd frontend
npm run build
```

## 9. Production hardening before public launch

This package is a working full-stack MVP. Before institutional production deployment, complete these tasks:

- Replace all demo accounts and credentials
- Set a long random `SECRET_KEY`
- Configure HTTPS and a real domain
- Confirm official meanings and workflows for CRA and CA
- Connect JKUAT identity/SSO if approved
- Configure institutional email notifications
- Set backup, retention and recovery policies
- Conduct stakeholder validation, security testing and UAT
- Add antivirus/malware scanning for uploaded documents
- Configure deployment monitoring and centralized logs
- Review privacy and records-management requirements with JKUAT offices

