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
- Personal agreement visibility: Champions see agreements they own or initiated;
  Linkages leadership retains the office-wide view
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
| G-05 | P2 | Template library and draft management | The request wizard loads active versioned templates; administrators and Linkages users can publish/archive templates, and agreements persist the selected template. | Implemented template metadata, version, agreement type, active/archive state, authorized upload/download, agreement selection, migration, and role checks through `GET/POST/PATCH /templates`. | `frontend/src/pages/AgreementForm.jsx`; `frontend/src/pages/Configuration.jsx`; `BACKEND_CAPABILITIES.templates=true` |
| G-06 | P2 | System configuration/reference data | Configuration and agreement-type reference data are loaded from backend routes; administrators can edit audited values. | Implemented admin-only configuration CRUD, authenticated reference-data reads, admin writes, audit logging and migration. | `frontend/src/pages/Configuration.jsx`; `BACKEND_CAPABILITIES.configuration=true`; `BACKEND_CAPABILITIES.referenceData=true` |
| G-07 | P2 | Persisted collaboration scorecards | Scorecards are now loaded from persisted, role-scoped backend snapshots. | Implemented versioned scorecard definitions, configurable weights, immutable calculation snapshots, recalculation history, audit events, `GET /scorecards`, `POST /scorecards/{agreement_id}/recalculate`, `GET /scorecards/{agreement_id}/history`, and `GET/POST /scorecards/definitions`. | `frontend/src/pages/Scorecards.jsx`; `frontend/src/lib/backend.js`; `BACKEND_CAPABILITIES.scorecards=true` |
| G-08 | P2 | Portfolio and generated reports | The Reports centre now loads a scoped portfolio snapshot and can generate PDF, Excel and server-side narrative outputs alongside the existing CSV export. | Implemented shared authorized portfolio aggregation, filter-aware `GET /reports/portfolio`, `POST /reports/ai-summary`, `GET /reports/export.pdf`, and `GET /reports/export.xlsx`, with audit logging and mock support. | `frontend/src/pages/Reports.jsx`; `frontend/src/lib/backend.js`; `BACKEND_CAPABILITIES.{portfolioReports,aiReports,pdfReports,excelReports}=true` |
| G-09 | P3 | External partner workspace | Partner users can accept a single-use invitation, sign in, view their organization workspace, and access only partner-scoped agreements and non-confidential shared documents. | Implemented `partner` identity, partner memberships, expiring invitation acceptance, backend agreement/document scope rules, partner-safe routes and frontend workspace. | `frontend/src/pages/PartnerPortal.jsx`; `frontend/src/pages/PartnerInvitationAccept.jsx`; `BACKEND_CAPABILITIES.partnerAccounts=true` |
| G-10 | P3 | Dedicated Champion directory route | The frontend currently uses the implemented `GET /users/champions` route. Older contract references mention `/directory/champions`. | No immediate work is required. Only add a separate directory resource if the Champion directory needs richer filtering or public-safe fields. | `frontend/src/lib/backend.js`; `frontend/BACKEND_API_CONTRACT.md` |
| G-11 | P2 | Historical collaboration data review | The imported workbook is retained as source data and loaded into a Linkages-only review queue before records become verified. | Implemented workbook importer, provenance fields, pending-review status, Linkages correction/verification APIs, audit events, and the Historical Data Review workspace. | `backend/scripts/import_collaborations.py`; `frontend/src/pages/HistoricalDataReview.jsx`; `BACKEND_CAPABILITIES.historicalDataReview=true` |

## Functionality that is intentionally frontend-only

These are not necessarily defects, but they should remain clearly labeled in
the UI until a backend decision is made:

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
5. G-05 and G-06: templates, configuration and reference data (implemented)
6. G-07: persisted scorecards
7. G-08: portfolio and report exports (implemented)
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
