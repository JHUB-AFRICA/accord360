# Accord360 frontend/backend integration gap register

Updated: 2026-09-15

This document records frontend functionality that is visible in the prototype
but is either not persisted by the backend, calculated only in the browser, or
awaits a backend endpoint. It is intended to be worked through one item at a
time.

## Current integration baseline

The following areas are connected to the FastAPI backend and should be tested
as live functionality rather than rebuilt:

- Authentication login and current-user lookup
- User administration and Champion directory
- Partner list, create and update
- Agreement list, create, update and detail views
- Workflow transitions and transition comments
- Agreement document upload and authorized download
- Deliverables, monitoring values and six-month reporting records
- Workspace dashboard and statistics
- Notifications and mark-as-read
- Agreement CSV export and audit report
- Help assistant chat (`POST /api/ai/chat`)

The source of truth for these existing routes remains
[`frontend/API_ENDPOINTS.md`](../frontend/API_ENDPOINTS.md). The frontend
real-mode calls are centralized in `frontend/src/lib/backend.js`.

## Prioritized gaps

| ID | Priority | Functionality | Current frontend behavior | Backend work needed | Evidence |
|---|---|---|---|---|---|
| G-01 | P1 | Public partner registration | The multi-step form submits institution details and supporting files, then shows the application reference. Email verification is represented by the backend flow; review is API-ready but has no dedicated frontend queue yet. | Implemented `POST /auth/register-partner`, hashed expiring verification tokens through `GET /auth/verify-partner-email`, application document storage, `GET /partners/applications`, and `PATCH /partners/applications/{id}/review`. Approval creates an active partner record. | `frontend/src/pages/PartnerRegister.jsx`; `frontend/src/lib/backend.js`; `BACKEND_CAPABILITIES.partnerApplications=true` |
| G-02 | P1 | Correction records and responses | The correction register now reads persisted records. Legal returns create structured correction records; responsible users can respond and the requesting review function can resolve them. | Implemented `Correction` records linked to workflow events, structured exact-item/requested-change/details fields, role-scoped list/detail routes, response-driven workflow advancement, resolution routes, audit events and migration. | `frontend/src/components/LegalReviewPanel.jsx`; `frontend/src/pages/Corrections.jsx`; `frontend/src/pages/CorrectionDetail.jsx`; `BACKEND_CAPABILITIES.dedicatedCorrections=true` |
| G-03 | P1 | Password assistance and account recovery | The Forgot Password page is informational only and sends no request. | Add single-use, expiring, hashed reset tokens and email delivery. Proposed routes: `POST /auth/forgot-password`, `POST /auth/reset-password`. Always return a generic response for unknown email addresses. | `frontend/src/pages/ForgotPassword.jsx`; `BACKEND_CAPABILITIES.passwordReset=false` |
| G-04 | P1 | Partner review decision history | The verification workspace records each status decision with a mandatory reason and displays the persisted history. | Implemented `POST /partners/{id}/review` and `GET /partners/{id}/reviews`, backed by `PartnerReviewEvent`, role checks, audit logging and migration. | `frontend/src/pages/PartnerVerification.jsx`; `frontend/src/lib/backend.js`; `BACKEND_CAPABILITIES.partnerReviewHistory=true` |
| G-05 | P2 | Template library and draft management | The UI displays document evidence, but there is no persisted template library or template selection/versioning. | Add template metadata, version, agreement type, active/archive state and authorized download. Proposed routes: `GET/POST/PATCH /templates`. | `frontend/src/pages/AgreementDetail.jsx`; `BACKEND_CAPABILITIES.templates=false` |
| G-06 | P2 | System configuration/reference data | Configuration is a readiness view; values are not saved. | Add admin-only configuration and reference-data resources with audit logging. Proposed routes: `GET/POST/PATCH /configuration` and `GET /reference-data`. | `frontend/src/pages/Configuration.jsx`; `BACKEND_CAPABILITIES.configuration=false` |
| G-07 | P2 | Persisted collaboration scorecards | Scores are calculated in the browser from deliverables, evidence, status and value records. | Add scorecard definitions, weights, calculated snapshots, recalculation history and role-scoped reads. Proposed routes: `GET /scorecards`, `POST /scorecards/{id}/recalculate`. | `frontend/src/pages/Scorecards.jsx`; `BACKEND_CAPABILITIES.scorecards=false` |
| G-08 | P2 | Portfolio and generated reports | CSV and audit reports work. PDF, Excel, portfolio and AI narrative exports are disabled. | Add scoped portfolio aggregation and server-side report generation. Proposed routes: `GET /reports/portfolio`, `POST /reports/ai-summary`, `GET /reports/export.pdf`, `GET /reports/export.xlsx`. | `frontend/src/pages/Reports.jsx`; `BACKEND_CAPABILITIES.{aiReports,pdfReports,excelReports}=false` |
| G-09 | P3 | External partner workspace | A placeholder page explains that the current backend has internal roles only. | Add partner identity, organization membership, invitation, scope rules and partner-facing agreement/document routes. | `frontend/src/pages/PartnerPortal.jsx`; `BACKEND_CAPABILITIES.partnerAccounts=false` |
| G-10 | P3 | Dedicated Champion directory route | The frontend currently uses the implemented `GET /users/champions` route. Older contract references mention `/directory/champions`. | No immediate work is required. Only add a separate directory resource if the Champion directory needs richer filtering or public-safe fields. | `frontend/src/lib/backend.js`; `frontend/BACKEND_API_CONTRACT.md` |

## Functionality that is intentionally frontend-only

These are not necessarily defects, but they should remain clearly labeled in
the UI until a backend decision is made:

- Score previews are client calculations; they are not authoritative records.
- AI narrative preview/report generation is not the same as the implemented
  instructional chat endpoint.
- The `upload_official_signed` workflow action is represented through the
  existing document upload flow and is marked frontend-only in the workflow
  configuration.
- Partner application review still needs a dedicated frontend queue; the
  backend review API is available, but the current public form only covers
  submission.
- The mock API is for explicit frontend review only and must not be enabled for
  a live demonstration of backend security.

## Recommended implementation order

1. G-01: public partner application and review foundation (implemented)
2. G-02: corrections and response history (implemented)
3. G-04: partner review audit trail (implemented)
4. G-03: password recovery and the broader authentication/security workstream
5. G-05 and G-06: templates, configuration and reference data
6. G-07: persisted scorecards
7. G-08: portfolio and report exports
8. G-09: external partner workspace

The first four items create the most visible end-to-end completeness and give
the prototype a credible onboarding, review and accountability story.

## Definition of done for each gap

For every item we implement, update all of the following together:

1. Database model and migration
2. Pydantic request/response schemas
3. Authorized FastAPI route and service logic
4. Frontend API wrapper in `frontend/src/lib/backend.js`
5. Loading, empty, error and unauthorized states in the UI
6. Backend tests for authorization and scope boundaries
7. Frontend contract/mock test where the feature is represented in mock mode
8. This register and `frontend/API_ENDPOINTS.md`

No frontend screen should silently persist important business data only in
browser state.
