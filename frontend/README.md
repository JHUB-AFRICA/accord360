# Accord360 Frontend

Production-oriented React/Vite frontend for the JKUAT Directorate of Linkages (RPE) agreement and partnership lifecycle platform.

## Included workspaces

- Public portal and external-partner registration
- External-partner dashboard, shared requests, documents and corrections
- Researcher/Initiator request wizard and owned-record tracking
- Faculty/Department approval queue
- Linkages partner verification and lifecycle operations
- Legal review, clause comments, correction handling and legal-version locking
- DVC RPE endorsement queue
- VC Office submission, signature tracking and signed-file workflow
- Six-month M&E reporting, evidence and collaboration scorecards
- Executive reporting and human-reviewed AI-summary draft
- User administration, configurable agreement types, scoring weights and audit log
- Accessible loading, empty, error, denied and responsive states

The frontend uses the single canonical 17-stage workflow defined in `src/lib/workflow.js`.

## Run immediately in demonstration mode

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Open `http://localhost:5173`.

The supplied `.env.example` enables browser-persistent mock mode. All screens and workflow actions can therefore be reviewed before the real backend is complete.

## Use the real FastAPI backend

Set:

```env
VITE_API_URL=http://127.0.0.1:8000/api
VITE_USE_MOCK_API=false
```

Then restart Vite. The backend must implement the contracts in `BACKEND_API_CONTRACT.md`.

## Quality checks

```powershell
npm run validate
npm run build
npm run check
```

- `validate` verifies local imports, required files and prohibited legacy wording.
- `test:mock` executes the twelve-role permission and end-to-end workflow smoke tests.
- `build` runs validation and creates a production bundle.
- `check` runs validation, mock integration tests and the production build.



## Handoff documents

- `BACKEND_API_CONTRACT.md` — required endpoints, permissions, payloads and file behavior.
- `DEVELOPER_HANDOFF.md` — route/role map, source map and integration checklist.
- `QUALITY_REPORT.md` — automated checks completed and the final local/CI build command.
- `FRONTEND_IMPLEMENTATION_NOTES.md` — stakeholder corrections incorporated.

## Demo accounts

| Workspace | Email | Password |
|---|---|---|
| Researcher | researcher@accord360.app | Research@123 |
| Faculty Approver | approver@accord360.app | Approver@123 |
| Linkages Officer | linkages@accord360.app | Linkages@123 |
| Director, Linkages | director.linkages@accord360.app | Director@123 |
| Legal Reviewer | legal@accord360.app | Legal@123 |
| DVC RPE | dvc.rpe@accord360.app | DvcRpe@123 |
| VC Office | vc.office@accord360.app | VcOffice@123 |
| M&E Officer | me@accord360.app | Measure@123 |
| Executive | executive@accord360.app | Executive@123 |
| Administrator | admin@accord360.app | Admin@123 |
| Auditor | auditor@accord360.app | Auditor@123 |
| External Partner | partner@eait.example | Partner@123 |

These are synthetic prototype accounts and are never used when `VITE_USE_MOCK_API=false`.

## Security notes

- Mock mode is explicit; it never activates as a fallback after a real-backend authentication failure.
- A `401` clears the session and returns the user to authentication.
- Frontend route guards improve UX, but the backend remains responsible for authoritative authorization and record scoping.
- Administrators have configuration access only; Legal approval, DVC endorsement, VC execution and operational approvals remain separated.
