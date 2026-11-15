# Accord360 Frontend

Production-oriented React frontend for the JKUAT Directorate of Linkages (RPE) Accord360 platform.

## API source of truth

`API_ENDPOINTS.md` is the authoritative description of the currently implemented FastAPI backend. All real-mode network calls are centralized in `src/lib/backend.js` and use only routes documented in that file.

The frontend does **not** silently call newer, assumed or arbitrary endpoints. Where the UI includes a future feature that the backend does not yet expose, the screen is explicitly read-only, locally calculated or marked as backend-pending.

## Run locally

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run validate
npm run syntax
npm run test:mock
npm run dev
```

Open `http://localhost:5173`.

The backend should run at `http://127.0.0.1:8000`, with API routes under `http://127.0.0.1:8000/api`.

## Environment

```env
VITE_API_URL=http://127.0.0.1:8000/api
VITE_USE_MOCK_API=false
```

Real backend mode is the default. Mock mode must be enabled deliberately:

```env
VITE_USE_MOCK_API=true
```

Mock mode mirrors the same implemented endpoint names and response shapes; it is not activated after failed authentication.

## Implemented backend integrations

- `POST /auth/login`
- `GET /auth/me`
- `GET/POST/PATCH /users`
- `GET /users/researchers`
- `GET/POST /partners`
- `PUT /partners/{id}`
- `GET/POST/PATCH /agreements`
- `POST /agreements/{id}/transition`
- Agreement document list and bearer-token download; uploads are role/status
  controlled and Legal/Researcher do not receive upload controls
- Deliverable create/update and value creation
- `GET /dashboard/workspace`
- `GET /dashboard/stats`
- Notification list and mark-read
- Scoped agreement CSV export
- Authorized audit report
- Researcher quarterly progress updates and M&E portfolio progress reads
- Linkages template upload, placeholder validation, activation/deactivation,
  and FieldDefinition authoring guide

## Features represented without unsupported calls

The current backend does not implement public partner accounts, password reset,
AI report generation, PDF export or Excel export. Persisted templates,
configuration, comments, progress updates and expiry automation are implemented
for the rebuilt four-role workflow.

The frontend handles these gaps as follows:

- Corrections are derived from agreement workflow transition comments.
- Scorecards are transparent client calculations from backend-visible deliverables, evidence, risk and value data.
- Six-month reporting writes deliverables, evidence documents and value records.
- Configuration and template pages use the authenticated Linkages template and
  configuration routes; the template authoring guide reads FieldDefinition rows.
- AI narrative is a deterministic local preview clearly labeled for human review.
- PDF and Excel buttons are disabled until corresponding backend routes exist.
- Public partner registration is a completed UI form but does not claim to submit data.
- Password assistance provides administrator guidance without calling a nonexistent route.

## Role values

The frontend uses exactly these backend role names:

`researcher`, `linkages`, `legal`, `me`.

There is no authenticated `partner` role in the current backend contract.

## Quality commands

```powershell
npm run validate
npm run syntax
npm run test:mock
npm run build
npm run check
```

`validate` checks file integrity, central API usage and forbidden endpoint fragments. `syntax` parses every JavaScript and JSX source file. `test:mock` exercises the exact endpoint contract and complete approval-to-activation workflow.
