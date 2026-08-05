# Accord360 Frontend Developer Handoff

## Runtime modes

- `VITE_USE_MOCK_API=true`: browser-persistent demonstration database and complete clickable workflow.
- `VITE_USE_MOCK_API=false`: all requests go to `VITE_API_URL`; no automatic mock fallback occurs.

The frontend treats backend authorization as authoritative. A `401` clears the local session. A `403` is displayed as a permission failure; the UI never upgrades permissions locally.

## Primary routes and permitted roles

| Route | Workspace | Roles |
|---|---|---|
| `/partner/dashboard` | External partner dashboard | partner |
| `/partner/registration` | Verification status | partner |
| `/partner/requests` | Shared partnership requests | partner |
| `/researcher` | Researcher dashboard | researcher |
| `/agreements/new` | Six-step request wizard | researcher, linkages, director_linkages |
| `/approvals/queue` | Faculty approval queue | approver |
| `/linkages/queue` | Linkages review queue | linkages, director_linkages |
| `/legal/queue` | Legal queue | legal |
| `/legal/:id` | Clause review and corrections | legal |
| `/dvc/queue` | DVC RPE endorsement queue | dvc |
| `/dvc/:id` | Endorsement package | dvc |
| `/signing/queue` | VC submission/signing queue | vc_office |
| `/signing/:id` | Signing and execution | vc_office |
| `/monitoring/reports/:id` | Six-month report | assigned Champion, M&E, Linkages reviewers |
| `/scorecards` | Partnership scoring | me, linkages, director_linkages, executive |
| `/reports` | Reports and human-reviewed AI narrative | authorized reporting roles |
| `/users` | User administration | admin |
| `/configuration` | Agreement types, templates, checklists, SLAs and scoring | admin |
| `/audit` | Immutable audit view | admin, auditor, executive, director_linkages |

All generic agreement and partner routes are additionally protected by record scope returned from the API.

## Canonical workflow

The UI uses only the stage values in `src/lib/workflow.js`:

`partner_inquiry → partner_verification → champion_assignment → agreement_details → draft_documents → faculty_review → linkages_review → legal_review → legal_locked → dvc_endorsement → vc_submission → signing → signed_upload → activation → me_reporting → scoring → renewal_closure`

The frontend sends named actions rather than directly editing stage/status fields. The backend must reject invalid transitions even when a malicious client bypasses the UI.

## Frontend state expectations

Every data page includes loading and request-error handling. Major lists provide empty states. Mutations use confirmation modals or explicit forms and surface backend validation messages. Tables convert to labeled cards below the mobile breakpoint.

## Backend integration checklist

1. Implement `BACKEND_API_CONTRACT.md` beneath the configured API base URL.
2. Preserve the canonical role and stage strings exactly or provide a translation layer.
3. Enforce record scope, workflow gates, immutable Legal/final documents and separation of duties server-side.
4. Return `{ "detail": "..." }` for validation and authorization errors.
5. Send `Content-Disposition` for file downloads.
6. Replace mock file metadata with secure binary uploads/object-storage references.
7. Generate notification, email and audit records for every workflow mutation.
8. Run `npm run check` after connecting the real API and add backend-backed end-to-end tests in CI.

## Frontend source map

- `src/App.jsx`: route and role guards
- `src/components/Layout.jsx`: role-specific navigation
- `src/lib/api.js`: real/mock transport boundary
- `src/lib/mockApi.js`: persistent demonstration API
- `src/lib/workflow.js`: lifecycle labels, actions and mock transitions
- `src/data/mockData.js`: consistent synthetic prototype data
- `src/pages/AgreementForm.jsx`: request wizard
- `src/pages/AgreementDetail.jsx`: agreement workspace and activation controls
- `src/components/LegalReviewPanel.jsx`: clause comparison/comments
- `src/components/DocumentRepository.jsx`: upload/download interface
- `src/pages/SixMonthReport.jsx`: Champion reporting and review return/validation
- `src/pages/Scorecards.jsx`: weighted scorecard
- `src/pages/Configuration.jsx`: administrator configuration
