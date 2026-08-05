# Accord360 Frontend–Backend API Contract

This document lists the API surface expected by the final frontend. All routes are relative to `VITE_API_URL`, normally `http://127.0.0.1:8000/api`.

## General rules

- Use JSON unless an endpoint explicitly returns a file.
- Authentication uses `Authorization: Bearer <token>`.
- Error responses use `{ "detail": "Human-readable explanation" }` and an appropriate status.
- Return `401` for expired/invalid authentication, `403` for authorization failure, `404` for an inaccessible/nonexistent scoped record, `409` for conflicts and `422` for validation errors.
- The backend must enforce permissions and record scope. Frontend route guards are not security controls.
- Every workflow mutation must create an audit event and any required notification/email.
- Use ISO 8601 timestamps and stable opaque IDs. Agreement references use `JKUAT/ACC/YYYY/NNNN`.

## Authentication and public partner registration

### `POST /auth/login`
Request:
```json
{ "email": "user@example.com", "password": "secret" }
```
Response:
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "user": {
    "id": "usr-1",
    "full_name": "Jane Muthoni",
    "email": "jane@jkuat.ac.ke",
    "role": "linkages",
    "department": "Directorate of Linkages (RPE)",
    "faculty": null,
    "partner_id": null,
    "is_active": true
  }
}
```

### `GET /auth/me`
Returns the authenticated user.

### `POST /auth/forgot-password`
Accepts `{ "email": "..." }`. Always returns a privacy-safe generic confirmation whether or not an account exists. The backend queues a time-limited reset link only for an eligible active account.

### `POST /auth/register-partner`
Creates an external-partner application. Required fields include institution name/type, country, region, website, contact details, collaboration area and supporting-document metadata. Returns a public application reference and `pending_review` status.

### `GET /auth/registration/{reference}`
Returns the public-safe registration status for the supplied application reference.

The backend should also support password reset, email verification and session-expiry handling even though prototype account-state screens can display without additional data.

## Dashboard

### `GET /dashboard`
Returns role-specific KPIs, tasks, recent records and alerts. Never return records outside the caller’s permitted scope.

## Directory and reference data

### `GET /reference-data`
Returns active agreement types, institution types, countries, faculties, departments and required-document rules. Only published/active options should be selectable in operational forms.

### `GET /directory/champions`
Returns active internal users eligible for Champion assignment. This endpoint must expose only public staff-directory fields, not administrative user details.

### `GET /templates`
Returns published templates available to the caller, including agreement type, version, effective date, owner and status.

## Agreements

### `GET /agreements`
Supported optional query parameters: `search`, `stage`, `status`, `type`, `risk`.

The result must be scoped by role:
- Researcher: owned/assigned records
- Faculty Approver: faculty or assigned-review records
- Legal/DVC/VC: assigned or relevant-stage records
- Partner: records explicitly shared with that partner
- Executive/Auditor: read-only authorized portfolio
- Linkages: authorized operational portfolio

### `POST /agreements`
Creates a draft or submits a complete request. Request fields include partner, agreement type, purpose, collaboration area, strategic alignment, dates, expected outcomes, JKUAT ownership, Champion, template and document metadata.

### `GET /agreements/{id}`
Returns one scoped agreement with lifecycle history, documents, corrections, legal comments, signing information and activation data.

### `PATCH /agreements/{id}`
Updates editable fields only. Locked/legal-approved fields must be rejected server-side.

### `POST /agreements/{id}/actions/{action}`
Supported action keys:
- `submit`
- `approve_faculty`
- `return_correction`
- `reject`
- `approve_linkages`
- `request_amendment`
- `approve_legal`
- `endorse_dvc`
- `release_vc`
- `record_vc_signature`
- `record_partner_signature`
- `upload_signed`
- `activate`
- `submit_me_report`
- `validate_me_report`
- `score`
- `renew`
- `close`
- `archive`

Mutation payloads may include mandatory `reason`, requested recipient, affected item, date, effective/expiry dates and file metadata as appropriate. Activation additionally requires `partner_liaison_name` and `initial_deliverable`. The backend must validate the canonical stage, signing gates, role and record scope before applying a transition.



### `POST /agreements/{id}/documents`
Uploads a working, supporting, Legal-approved or final-signed document using multipart/form-data or an approved presigned-upload flow. Required metadata includes type, confidentiality classification and version.

### `GET /agreements/{id}/documents/{documentId}/download`
Returns or redirects to an access-controlled file download. The backend must enforce record scope, confidentiality and immutable-version rules.

### `POST /agreements/{id}/legal-comments`
Creates a clause/field/document-level legal comment. Fields include exact target, comment text, blocking flag and visibility.

### `POST /agreements/{id}/legal-comments/{commentId}/resolve`
Updates resolution status. Legal approval must be blocked while unresolved blocking comments exist.

## Partners

### `GET /partners`
Returns partners permitted to the caller. External partners may see only their own profile.

### `GET /partners/{id}`
Returns institution profile, contacts, verification evidence, agreements, performance, activity and permitted notes.

### `PATCH /partners/{id}`
Updates only fields permitted to the caller. External partners may update their own contact details; Linkages/Admin may update authorized institutional metadata.

### `POST /partners/{id}/verify`
Linkages-only decision: `verified`, `additional_information_required` or `rejected`. Requires a reason, reviewer identity, timestamp and optional Champion assignment.

## Corrections

### `GET /corrections`
Returns scoped corrections.

### `GET /corrections/{id}`
Returns a structured correction with exact field/document/clause target, previous value/version, requested change, reason, due date, deep link, history and response.

### `POST /corrections/{id}/respond`
Submits a response and optional replacement-document metadata.

### `POST /corrections/{id}/resolve`
Authorized reviewer accepts the response. Requires an optional resolution note and audit event.

## Notifications

### `GET /notifications`
Returns notifications for the authenticated user/role. Each item should include record reference, sender, required action, due date, priority, escalation, deep link, email status, in-app status and reminder history.

### `POST /notifications/{id}/read`
Marks a notification read.

### `POST /notifications/{id}/resend`
Queues a failed or requested email resend and appends the attempt to reminder history. Restricted to the recipient and authorized operational/admin roles.

The production backend should also provide notification-preference endpoints.

## M&E and scorecards

### `GET /me/reports`
Returns scoped six-month reports.

### `GET /me/reports/{id}`
Returns one report including activities, deliverables, target/actual, evidence, challenges, engagement, value and recommendation.

### `PATCH /me/reports/{id}`
Saves a draft, submits to Linkages, validates or returns a report according to role and status. A returned report requires a non-empty `review_note`, creates a correction notification for the Champion and preserves the review history.

### `GET /scorecards`
Returns authorized partnership scorecards.

### `POST /scorecards/{id}/recalculate`
Recalculates using the versioned active scoring configuration. Active component weights must total exactly 100%.

## Reports

### `GET /reports/portfolio`
Returns verified portfolio totals and chart-ready datasets.

### `POST /reports/ai-summary`
Returns a draft narrative, findings, supporting-record links, data timestamp, filters, metric definitions and the disclaimer:

> This summary was generated from the selected system records. All figures and conclusions must be reviewed before approval.

The AI endpoint must not approve records or finalize/export without human approval.

### `POST /reports/ai-summary/{id}/approve`
Human reviewer approves an edited narrative. Returns reviewer identity, approval timestamp, approved narrative and immutable report version.

### `GET /reports/agreements.csv`
Returns a scoped CSV with `Content-Disposition` filename.

### `GET /reports/export.pdf`
Returns the authorized filtered report as a generated PDF.

### `GET /reports/export.xlsx`
Returns the authorized filtered report as an Excel workbook.

PDF and Excel exports must follow the same filters, record scope and human-approval rules as the on-screen report.

## Administration

### `GET /users`, `POST /users`, `PATCH /users/{id}`
Administrator-only user management. Never expose password hashes/secrets.

### `GET /configuration`, `PATCH /configuration`
Returns/updates reference data, agreement types, SLA rules, required-document rules, notifications and scoring weights. Backend must reject scoring configurations whose active weights do not total 100%.

### `GET /templates`, `POST /templates`, `PATCH /templates/{id}`
Lists available template versions and allows administrators to create drafts, publish approved versions or retire older versions. Published Legal-approved templates must remain versioned and historical versions must not be overwritten.

### `GET /audit`
Read-only for Admin, Auditor, authorized Executive and Linkages Director roles. Audit entries should be immutable.

## Files and uploads

The UI currently sends file metadata in mock mode. Production should implement secure upload endpoints using multipart/form-data or presigned object-storage URLs. Required controls include:
- MIME/type and size validation
- malware scanning
- confidentiality classification
- version history
- immutable Legal-approved and final-signed versions
- access-controlled download URLs
- uploader and checksum metadata

## Canonical role values

`partner`, `researcher`, `approver`, `linkages`, `director_linkages`, `legal`, `dvc`, `vc_office`, `me`, `executive`, `admin`, `auditor`.

## Canonical workflow stage values

`partner_inquiry`, `partner_verification`, `champion_assignment`, `agreement_details`, `draft_documents`, `faculty_review`, `linkages_review`, `legal_review`, `legal_locked`, `dvc_endorsement`, `vc_submission`, `signing`, `signed_upload`, `activation`, `me_reporting`, `scoring`, `renewal_closure`.
