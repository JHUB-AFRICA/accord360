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

## 2. Instructional AI assistant

### `POST /ai/chat`

Requires a valid bearer token. Sends a message to the L-ALPMS instructional
assistant and maintains temporary context for the returned `session_id`.

Request:

```json
{
  "session_id": "optional-existing-session-id",
  "message": "How do I submit an agreement for approval?"
}
```

Response:

```json
{
  "session_id": "generated-or-existing-session-id",
  "message": "..."
}
```

The session is held in backend memory, is isolated to the authenticated user,
expires after inactivity, and is lost when the backend process restarts. If
Gemini is not configured, the endpoint returns `503`.

### `DELETE /ai/chat/{session_id}`

Requires a valid bearer token. Immediately clears the authenticated user's
temporary chat session and returns `204 No Content`.

## 3. Roles

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

## 5. Users and administration

### `GET /users`

Requires `admin`. Returns `UserOut[]`.

### `GET /users/champions`

Requires `admin`, `linkages`, or `director_linkages`. Returns active researcher
accounts eligible to be assigned as Champions. The response uses `UserOut[]`.

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

## 7. Templates and configuration

### `GET /templates`

Requires authentication. Returns active versioned templates. Filter with
`agreement_type`; `include_archived=true` includes archived records.

### `POST /templates`

Requires `admin`, `linkages`, or `director_linkages`. Uses multipart form data
for `name`, `agreement_type`, `version`, optional `description`, and an optional
DOC, DOCX, ODT or PDF file up to 25 MB.

### `PATCH /templates/{template_id}`

Requires `admin`, `linkages`, or `director_linkages`. Updates template metadata
or status (`active`/`archived`).

### `GET /templates/{template_id}/download`

Requires authentication and returns the authorized template file.

### `GET/POST /configuration` and `PATCH /configuration/{key}`

Configuration reads and writes require `admin`. Values are audited and only
editable values can be changed.

### `GET /reference-data`

Requires authentication and returns active reference values, optionally filtered
by category. `POST /reference-data` and `PATCH /reference-data/{item_id}` require
`admin`.

## 8. Agreements

Agreement responses include nested `partner`, `owner`, and, for detail
responses, `documents`, `workflow_events`, `deliverables`, and `values`.
Agreement responses also include `template_id` when a versioned template was
selected during drafting.

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
  "champion_user_id": 2,
  "confidentiality": "internal",
  "internal_champion": "Jane Muthoni",
  "partner_liaison": "Partner Contact",
  "effective_date": "2026-01-01",
  "expiry_date": "2028-01-01"
}
```

`agreement_type` must be `MoU`, `CRA`, `CA`, or `Other`. `purpose` must be at
least 10 characters. Linkages roles must provide an active researcher
`champion_user_id`; researchers become the owner automatically.

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
  "internal_champion": "Jane Muthoni",
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
authorized agreements, including totals, distributions, approved value totals
and visible agreement rows.

### `GET /reports/export.pdf` and `GET /reports/export.xlsx`

Generate filter-aware portfolio exports from the same authorization scope and
record audit events.

### `POST /reports/ai-summary`

Accepts portfolio filters as JSON and returns a server-generated narrative from
the authorized portfolio snapshot. The response marks the result as requiring
human review.

### `GET /reports/audit`

Requires `admin`, `auditor`, `executive`, or `director_linkages`.

Optional query parameter:

```text
limit=100
```

`limit` must be between 1 and 500. Returns `AuditLogOut[]`.

### External partner workspace

`POST /auth/partner-invitations/{token}/accept` accepts a single-use,
expiring invitation and creates a `partner` account. Authenticated partner
users use `GET /partner/me`, `GET /partner/agreements`,
`GET /partner/agreements/{agreement_id}`, and the partner-scoped document
download route. Confidential documents are never exposed to partner users;
internal agreement routes reject the partner role.

## Agreement ownership and personal visibility

Each agreement records `owner_id` for the assigned Champion and `initiator_id`
for the user who created the request. Champion/researcher accounts can only
list and open agreements where they are the owner or initiator. Linkages and
Director of Linkages accounts retain the office-wide operational view. This
scope is enforced by the backend query and detail authorization checks, not
only by frontend filtering.

## Historical data review

Linkages users can review imported historical records through:

- `GET /data-review/summary`
- `GET /data-review?status=pending_review`
- `GET /data-review/{agreement_id}`
- `PATCH /data-review/{agreement_id}`
- `POST /data-review/{agreement_id}/verify`

Imported records retain source-row metadata and remain marked `pending_review`
until a Linkages reviewer corrects the record and verifies it. Corrections and
verification actions are written to the audit log.

## Persisted scorecards

`GET /scorecards` returns authorized active-agreement snapshots. M&E and
Linkages roles can create immutable snapshots with
`POST /scorecards/{agreement_id}/recalculate`; history is available through
`GET /scorecards/{agreement_id}/history`. Definitions are read and administered
through `GET/POST /scorecards/definitions`.

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

## 14. Routes expected by the newer frontend but not currently implemented

The following paths are present in some frontend code/contracts but are not
currently exposed by this backend:

```text
GET /directory/champions
GET /corrections
GET /corrections/{id}
POST /corrections/{id}/respond
POST /corrections/{id}/resolve
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
| `GET /directory/champions` | `GET /users/champions` |
| `PATCH /partners/{id}` | `PUT /partners/{id}` |
| `POST /agreements/{id}/actions/{action}` | `POST /agreements/{id}/transition` with `{ "action": "...", "comment": "..." }` |
| `agreement_type` query value named `type` | `agreement_type` |
| string user IDs | integer user IDs |

When the frontend needs a route or response shape that is not listed as
implemented above, it should not silently fall back to mock data in production.
The API contract should be updated jointly and tested against `/docs`.
