# Accord360 Backend API Reference

This document describes the API that is currently implemented by this backend.
It is the source of truth for frontend integration. Do not use an endpoint from
an older frontend contract unless it is listed here.

## 1. Base URL and conventions

When running locally:

```text
http://127.0.0.1:8000/api
```

The FastAPI interactive documentation is available at:

```text
http://127.0.0.1:8000/docs
```

All routes below are relative to `/api`. For example, `GET /users` means:

```text
GET http://127.0.0.1:8000/api/users
```

Authenticated requests must include:

```http
Authorization: Bearer <access_token>
```

JSON requests should include `Content-Type: application/json`. Date values use
`YYYY-MM-DD`; timestamps are ISO 8601 values.

Common response statuses:

- `200` successful read/update
- `201` successful creation/upload
- `400` invalid business input
- `401` missing, invalid, or expired token
- `403` authenticated user lacks permission
- `404` record or route not found
- `409` duplicate/conflicting record
- `413` uploaded file exceeds 25 MB
- `422` request failed Pydantic validation
- `502` object-storage failure

Errors normally have this shape:

```json
{"detail": "Human-readable explanation"}
```

## 2. Roles

The backend recognizes these role values:

```text
admin
researcher
approver
linkages
director_linkages
legal
dvc
vc_office
executive
me
auditor
```

Frontend route guards are not security controls. The backend applies
authentication, role checks, and agreement scope on every protected route.

## 3. Public health routes

### `GET /health`

This route is outside `/api`.

```http
GET http://127.0.0.1:8000/health
```

Response:

```json
{"status": "healthy", "environment": "development"}
```

### `GET /`

This route is outside `/api` and returns basic application information.

## 4. Authentication

### `POST /auth/login`

No token required.

Request:

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

Response:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "full_name": "System Administrator",
    "email": "admin@example.com",
    "role": "admin",
    "department": null,
    "is_active": true,
    "created_at": "2026-01-01T12:00:00"
  }
}
```

The `id` is an integer. Do not assume frontend mock IDs such as `usr-1`.

### `GET /auth/me`

Requires a valid token. Returns the authenticated `user` object shown above.

### `POST /auth/register-partner`

Public multipart form submission. This creates a pending partner application;
it does not create a login account or allow the applicant to choose an internal
role.

Required form fields:

```text
institution_name, institution_type, country, website,
contact_name, job_title, official_email, phone,
collaboration_area, strategic_alignment, consent
```

Optional fields are `region` and `registration_number`. Supporting files are
sent under the repeated `files` field and may be PDF, DOC or DOCX files up to
10 MB each.

Response status is `202`:

```json
{
  "reference_number": "JKUAT-PAR-2026-A1B2C3",
  "status": "pending_email_verification",
  "message": "Application received. Check the official email address to verify the application."
}
```

An active application for the same official email returns `409`. Verification
tokens are hashed in the database and are never returned in the API response.
In development, the verification token is written to the backend console email
log; a configured email provider is used when email delivery is enabled.

### `GET /auth/verify-partner-email?token=<token>`

Public, single-use email verification route. A valid, unexpired token changes
the application status to `pending_review` and returns its reference number.
Invalid or expired tokens return `400`.

## 5. Users and administration

### `GET /users`

Requires `admin`. Returns `UserOut[]`.

### `GET /users/researchers`

Requires `admin`, `linkages`, or `director_linkages`. Returns active researcher
accounts eligible to be assigned as Researchers. The response uses `UserOut[]`.

### `POST /users`

Requires `admin`.

Request:

```json
{
  "full_name": "Jane Muthoni",
  "email": "jane@example.com",
  "password": "AtLeast8Characters",
  "role": "researcher",
  "department": "Computing"
}
```

`role` must be one of the role values in section 2. `password` must be at least
8 characters. Returns the created `UserOut` with status `201`.

### `PATCH /users/{user_id}`

Requires `admin`.

Request fields are optional:

```json
{
  "full_name": "Updated Name",
  "role": "linkages",
  "department": "Directorate of Linkages",
  "is_active": true
}
```

Returns the updated `UserOut`.

## 6. Partners

### `GET /partners`

Requires a valid token. Returns `PartnerOut[]`.

Each partner contains:

```json
{
  "id": 1,
  "name": "Example University",
  "sector": "Education",
  "partner_type": "Institution",
  "country": "Kenya",
  "contact_name": "Contact Person",
  "contact_email": "contact@example.org",
  "legal_counterpart": "Legal Office",
  "liaison": "Partner Liaison",
  "status": "active",
  "created_at": "2026-01-01T12:00:00"
}
```

### `POST /partners`

Requires `researcher`, `linkages`, or `director_linkages`.

Request fields:

```json
{
  "name": "Example University",
  "sector": "Education",
  "partner_type": "Institution",
  "country": "Kenya",
  "contact_name": "Contact Person",
  "contact_email": "contact@example.org",
  "legal_counterpart": "Legal Office",
  "liaison": "Partner Liaison",
  "status": "active"
}
```

Only `name` and `sector` are required by validation. Returns `PartnerOut` with
status `201`; duplicate/conflicting records return `409`.

### `PUT /partners/{partner_id}`

Requires `linkages` or `director_linkages`. Uses the same request body as
`POST /partners` and returns the updated `PartnerOut`.

### `GET /partners/{partner_id}/reviews`

Requires `admin`, `linkages`, or `director_linkages`. Returns the partner's
decision history, newest first, including reviewer, previous status, new status,
mandatory reason and timestamp.

### `POST /partners/{partner_id}/review`

Requires `admin`, `linkages`, or `director_linkages`. Persists a status decision
and its reason:

```json
{
  "status": "additional_information_required",
  "reason": "Please provide the signed institutional registration document."
}
```

Allowed statuses are `active`, `under_review`,
`additional_information_required` and `rejected`.

### `GET /partners/applications`

Requires `admin`, `linkages`, or `director_linkages`. Returns public partner
applications, including supporting-document metadata but not document bytes.

### `PATCH /partners/applications/{application_id}/review`

Requires `admin`, `linkages`, or `director_linkages`.

Request:

```json
{
  "status": "approved",
  "review_notes": "Verified for institutional collaboration."
}
```

Allowed statuses are `needs_information`, `approved`, and `rejected`.
Applications must have verified their official email before review. Approval
creates an active record in the existing partner registry and records an audit
event.

### `POST /auth/partner-invitations/{token}/accept`

Public single-use invitation acceptance. The request contains a password of at
least eight characters. It creates a dedicated `partner` account and active
organization membership.

### Partner workspace routes

`GET /partner/me` returns the signed-in partner user's organization context.
`GET /partner/agreements` lists only agreements linked to that organization.
`GET /partner/agreements/{agreement_id}` returns a partner-safe agreement view,
and `GET /partner/agreements/{agreement_id}/documents/{document_id}/download`
allows only non-confidential shared documents. Internal agreement routes reject
the `partner` role.

## 7. Templates and configuration

### `GET /templates?agreement_type=<type>&include_archived=<bool>`

Requires authentication. Returns active, versioned agreement templates. Admin,
Linkages and Directorate Linkages users may request archived records as well.

### `POST /templates`

Requires `admin`, `linkages`, or `director_linkages`. Uses multipart form data
with `name`, `agreement_type`, `version`, optional `description` and optional
`file`. Template files may be DOC, DOCX, ODT or PDF up to 25 MB.

### `PATCH /templates/{template_id}`

Requires `admin`, `linkages`, or `director_linkages`. Updates the description,
name or `status` (`active` or `archived`). Template versions are immutable.

### `GET /templates/{template_id}/download`

Requires authentication and returns the authorized template file.

### `GET /configuration`

Requires `admin`. Returns audited operational configuration values.

### `POST /configuration` and `PATCH /configuration/{key}`

Require `admin`. Create or update editable configuration values. Every write is
recorded in the audit log.

### `GET /reference-data?category=<category>`

Requires authentication. Returns active reference values for UI selectors.
Administrators may create and update values through `POST /reference-data` and
`PATCH /reference-data/{item_id}`.

## 7. Corrections

Correction records are created automatically when an authorized workflow return
uses `return_correction` or `return_dvc`. Each record remains linked to its
originating workflow event.

### `GET /corrections`

Requires a valid token. Results are scoped to the user's agreement visibility.
Returns structured correction records with the agreement reference, exact item,
requested change, responsible users, response and resolution state.

### `GET /corrections/{correction_id}`

Requires a valid token and agreement access. Returns one correction record.

### `POST /corrections/{correction_id}/respond`

The assigned response role submits the correction response:

```json
{"response_text": "Updated the clause with the approved wording."}
```

For `return_correction`, the assigned Researcher or Linkages user responds and
the agreement advances through `submit`. For `return_dvc`, Legal responds and
the agreement advances through `approve_legal`.

### `POST /corrections/{correction_id}/resolve`

The requesting review function closes a responded correction:

```json
{"resolution_notes": "Reviewed and confirmed the requested correction."}
```

The correction is retained with its response and resolution audit history.

## 8. Agreements

Agreement responses include nested `partner`, `owner`, and, for detail
responses, `documents`, `workflow_events`, `deliverables`, and `values`.

### `GET /agreements`

Requires a valid token. Results are scoped to the authenticated user and role.

Supported query parameters:

```text
search=<title/reference/partner text>
stage=<stage>
status=<status>
agreement_type=<MoU|CRA|CA|Other>
department=<department>
```

Example:

```text
GET /agreements?stage=legal_review&status=legal_stalled
```

Returns `AgreementListOut[]`:

```json
{
  "id": 12,
  "reference_number": "JKUAT-MOU-2026-0012",
  "title": "Research Collaboration",
  "agreement_type": "MoU",
  "department": "Computing",
  "stage": "legal_review",
  "status": "under_review",
  "status_color": "orange",
  "next_action": "Legal review required",
  "partner": {},
  "owner": {},
  "effective_date": "2026-01-01",
  "expiry_date": "2028-01-01",
  "legal_review_days": 4,
  "days_to_expiry": 514,
  "created_at": "2026-01-01T12:00:00",
  "updated_at": "2026-01-02T12:00:00"
}
```

### `POST /agreements`

Requires `researcher`, `linkages`, or `director_linkages`.

Request:

```json
{
  "title": "Research Collaboration",
  "agreement_type": "MoU",
  "purpose": "A sufficiently detailed purpose description.",
  "expected_outcomes": "Expected outcomes",
  "strategic_alignment": "Strategic alignment",
  "department": "Computing",
  "partner_id": 1,
  "researcher_user_id": 2,
  "confidentiality": "internal",
  "internal_researcher": "Jane Muthoni",
  "partner_liaison": "Partner Contact",
  "effective_date": "2026-01-01",
  "expiry_date": "2028-01-01"
}
```

`agreement_type` must be `MoU`, `CRA`, `CA`, or `Other`. `purpose` must be at
least 10 characters. Linkages roles must provide an active researcher
`researcher_user_id`; researchers become the owner automatically.

Returns `AgreementDetailOut` with status `201`.

### `GET /agreements/{agreement_id}`

Requires a valid token and agreement visibility. Returns `AgreementDetailOut`.

### `PATCH /agreements/{agreement_id}`

Requires a valid token and edit permission. Send only fields being changed:

```json
{
  "title": "Updated title",
  "purpose": "Updated purpose with enough detail.",
  "expected_outcomes": "Updated outcomes",
  "strategic_alignment": "Updated alignment",
  "department": "Computing",
  "confidentiality": "confidential",
  "internal_researcher": "Jane Muthoni",
  "partner_liaison": "Partner Contact",
  "effective_date": "2026-01-01",
  "expiry_date": "2028-01-01",
  "signing_date": "2026-02-01",
  "date_sent_vc": "2026-01-20",
  "date_sent_partner": "2026-01-25",
  "assigned_approver_id": 3,
  "assigned_linkages_id": 4,
  "legal_reviewer_id": 5,
  "next_action": "Awaiting partner signature"
}
```

Researchers may edit only their permitted request fields. VC Office may edit
only signing-related fields. Returns `AgreementDetailOut`.

### `POST /agreements/{agreement_id}/transition`

Requires a valid token, agreement visibility, and permission for the current
workflow stage.

Request:

```json
{
  "action": "approve_department",
  "comment": "Department review completed."
}
```

Supported actions:

```text
submit
approve_department
return_correction
approve_linkages
send_legal
approve_legal
approve_dvc
return_dvc
submit_vc
record_vc_signature
mark_signed
activate
renew
close
archive
reject
```

`comment` is optional in the schema but required by some workflow actions.
Returns the updated `AgreementDetailOut`.

## 8. Agreement documents

### `GET /agreements/{agreement_id}/documents`

Requires agreement visibility. Returns only documents the user is allowed to
download.

### `POST /agreements/{agreement_id}/documents`

Requires agreement visibility and document-upload permission. Use
`multipart/form-data`, not JSON.

Required file field:

```text
file=<binary file>
```

Optional form fields:

```text
document_type=supporting
version=1.0
confidentiality=internal
is_official=false
```

Allowed confidentiality values are `public`, `internal`, and `confidential`.
Allowed file extensions are `pdf`, `doc`, `docx`, `xls`, `xlsx`, `csv`, `png`,
`jpg`, `jpeg`, and `txt`. Maximum size is 25 MB. Returns `DocumentOut` with
status `201`.

### `GET /agreements/{agreement_id}/documents/{document_id}/download`

Requires permission to download the specific document. Returns the file as a
download response. The frontend should send the bearer token when requesting
this URL.

## 9. Monitoring and evaluation

### `POST /agreements/{agreement_id}/deliverables`

Requires agreement visibility and M&E update permission.

Request:

```json
{
  "deliverable_type": "Joint research output",
  "target_value": 4,
  "actual_value": 2,
  "reporting_period": "2026 H1",
  "notes": "Progress notes",
  "evidence_document_id": 14
}
```

`target_value` and `actual_value` must be non-negative. Evidence documents must
belong to the same agreement. Returns `DeliverableOut` with status `201`.

### `PUT /agreements/{agreement_id}/deliverables/{deliverable_id}`

Uses the same body and permission rules as the create route. Returns the
updated `DeliverableOut`.

### `POST /agreements/{agreement_id}/values`

Requires agreement visibility and value-record permission.

Request:

```json
{
  "value_type": "Research funding",
  "amount": 125000,
  "currency": "KES",
  "source": "Signed grant",
  "reporting_period": "2026 H1",
  "approved": true
}
```

Returns `ValueRecordOut` with status `201`. M&E-created values are stored as
unapproved regardless of the submitted `approved` value.

## 10. Dashboard

Both dashboard routes require a valid token and apply the user’s agreement
scope.

### `GET /dashboard/workspace`

Returns role-specific workspace configuration, metrics, and queue records:

```json
{
  "role": "admin",
  "role_label": "System Administrator",
  "eyebrow": "Technical administration",
  "title": "Access and system administration",
  "description": "...",
  "permission_summary": "...",
  "capabilities": ["Manage users", "Assign roles"],
  "guidance": ["..."],
  "queue_title": "Recent records for administrative visibility",
  "queue_description": "...",
  "primary_action": null,
  "show_portfolio_analytics": true,
  "metrics": [],
  "queue": []
}
```

### `GET /dashboard/stats`

Returns chart-ready portfolio statistics:

```json
{
  "kpis": {
    "active_partnerships": 3,
    "pipeline_volume": 5,
    "at_risk": 1,
    "value_by_currency": [{"currency": "KES", "amount": 125000.0}]
  },
  "by_stage": [{"name": "Legal Review", "value": 2}],
  "by_type": [{"name": "MoU", "value": 4}],
  "by_risk": [{"name": "Orange", "value": 1}],
  "monthly_pipeline": [{"month": "Aug 2026", "count": 2}],
  "recent_agreements": []
}
```

There is currently **no** `GET /dashboard` route. A frontend calling that path
will receive `404 Not Found`. The frontend must call `/dashboard/workspace`
and/or `/dashboard/stats`, and map their response fields correctly.

## 11. Notifications

### `GET /notifications`

Requires a valid token. Returns the authenticated user’s latest 50
notifications as `NotificationOut[]`.

### `POST /notifications/{notification_id}/read`

Requires ownership of the notification. Marks it as read and returns the
updated `NotificationOut`.

## 12. Reports and audit

### `GET /reports/agreements.csv`

Requires a valid token. Returns a scoped CSV download.

Supported query parameters:

```text
stage
status
agreement_type
department
partner_sector
expiry_from=YYYY-MM-DD
expiry_to=YYYY-MM-DD
```

The result is scoped by the authenticated user. The response includes a
`Content-Disposition` filename.

### `GET /reports/portfolio`

Returns a filter-aware portfolio snapshot scoped to the authenticated user's
authorized agreements. It includes totals, distributions by workflow stage,
agreement type, sector and department, approved value totals and visible rows.

### `GET /reports/export.pdf` and `GET /reports/export.xlsx`

Generate filter-aware PDF and Excel portfolio downloads from the same
authorization scope and record audit events.

### `POST /reports/ai-summary`

Accepts the portfolio filters as JSON and returns a server-generated narrative
from the authorized portfolio snapshot. The response identifies its source and
requires human review before distribution.

### `GET /reports/audit`

Requires `admin`, `auditor`, `executive`, or `director_linkages`.

Optional query parameter:

```text
limit=100
```

`limit` must be between 1 and 500. Returns `AuditLogOut[]`.

## 13. Frontend integration example

```js
const API_URL = "http://127.0.0.1:8000/api";

async function api(path, options = {}) {
  const token = localStorage.getItem("accord360_token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

const workspace = await api("/dashboard/workspace");
const stats = await api("/dashboard/stats");
const agreements = await api("/agreements?stage=legal_review");
```

For uploads, pass `FormData` and do not manually set its `Content-Type`; the
browser must add the multipart boundary.

## Historical data review

Linkages users use `GET /data-review/summary`,
`GET /data-review?status=pending_review`, `GET /data-review/{id}`,
`PATCH /data-review/{id}`, and `POST /data-review/{id}/verify` to correct and
verify imported historical collaboration records.

## 14. Routes expected by the newer frontend but not currently implemented

The following paths are present in some frontend code/contracts but are not
currently exposed by this backend:

```text
GET/POST/PATCH /configuration
GET/POST/PATCH /templates
GET /reference-data
GET /directory/researchers
GET /reports/portfolio
POST /reports/ai-summary
GET /reports/export.pdf
GET /reports/export.xlsx
POST /auth/forgot-password
```

Frontend developers must either use the implemented routes in this document,
or coordinate a backend change before integrating these paths. A `404` means
the route is not implemented; a `401` means the route exists but the request
did not include a valid token; a `403` means the token’s role is insufficient.

## 15. Important current naming differences

Use these backend names exactly:

| Frontend assumption | Backend implementation |
|---|---|
| `GET /dashboard` | `GET /dashboard/workspace` and `GET /dashboard/stats` |
| `GET /directory/researchers` | `GET /users/researchers` |
| `PATCH /partners/{id}` | `PUT /partners/{id}` |
| `POST /agreements/{id}/actions/{action}` | `POST /agreements/{id}/transition` with `{ "action": "...", "comment": "..." }` |
| `agreement_type` query value named `type` | `agreement_type` |
| string user IDs | integer user IDs |

When the frontend needs a route or response shape that is not listed as
implemented above, it should not silently fall back to mock data in production.
The API contract should be updated jointly and tested against `/docs`.
