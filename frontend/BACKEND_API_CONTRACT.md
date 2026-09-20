# Accord360 Frontend Integration Contract

The detailed source of truth is [`API_ENDPOINTS.md`](./API_ENDPOINTS.md). This document explains how the frontend uses that contract.

## Contract boundary

All real backend calls are implemented in `src/lib/backend.js`. UI pages import named functions from that module rather than assembling endpoint paths themselves.

## Exact naming corrections

| Frontend operation | Implemented backend route |
|---|---|
| Workspace dashboard | `GET /dashboard/workspace` |
| Portfolio statistics | `GET /dashboard/stats` |
| Researcher directory | `GET /users/researchers` |
| Update partner | `PUT /partners/{partner_id}` |
| Review partner | `POST /partners/{partner_id}/review` and `GET /partners/{partner_id}/reviews` |
| Template library | `GET/POST /templates`, `PATCH /templates/{template_id}`, `GET /templates/{template_id}/download` |
| Configuration | `GET/POST /configuration`, `PATCH /configuration/{key}` |
| Reference data | `GET /reference-data`, `POST/PATCH /reference-data` |
| Perform workflow action | `POST /agreements/{agreement_id}/transition` with `{ action, comment }` |
| Filter agreement type | Query parameter `agreement_type` |
| User and record IDs | Integers |
| Audit report | `GET /reports/audit` |
| Agreement export | `GET /reports/agreements.csv` |
| Portfolio report | `GET /reports/portfolio` |
| Generated reports | `GET /reports/export.pdf`, `GET /reports/export.xlsx`, `POST /reports/ai-summary` |

## Agreement type values

The current backend accepts only:

- `MoU`
- `CRA`
- `CA`
- `Other`

The frontend does not submit `MoA` until the backend schema is changed.

## Workflow actions

The frontend submits only these transition actions:

- `submit`
- `approve_department`
- `return_correction`
- `approve_linkages`
- `send_legal`
- `approve_legal`
- `approve_dvc`
- `return_dvc`
- `submit_vc`
- `record_vc_signature`
- `mark_signed`
- `activate`
- `renew`
- `close`
- `archive`
- `reject`

The frontend applies role and state visibility for usability. The backend remains the security authority.

## Multipart document uploads

The frontend sends `FormData` to `POST /agreements/{agreement_id}/documents` with:

- `file`
- `document_type`
- `version`
- `confidentiality`
- `is_official`

It does not set `Content-Type` manually, allowing the browser to supply the multipart boundary.

## Implemented scorecard routes

Scorecard pages use persisted, role-scoped snapshots through `GET /scorecards`,
`POST /scorecards/{agreement_id}/recalculate`, and
`GET /scorecards/{agreement_id}/history`. Administrators can inspect and publish
versioned definitions through `GET/POST /scorecards/definitions`.

Agreement responses include both `owner` (the assigned Researcher) and
`initiator` (the user who created the request). Personal Researcher views are
backend-scoped to agreements where either field identifies the current user;
Linkages office roles retain their authorized office-wide scope.

Historical records are reviewed through the protected `/data-review` routes.
The UI preserves the original source fields, saves Linkages corrections, and
requires a Researcher assignment before marking a record verified.

## Unsupported backend capabilities

No production request is sent to:

- `/dashboard`
- `/directory/researchers`
- `/auth/forgot-password`
- `/auth/register-partner`
- `/me/reports`
- notification resend routes
- `/agreements/{id}/actions/{action}`

Correction records are implemented through `GET /corrections`,
`GET /corrections/{id}`, `POST /corrections/{id}/respond`, and
`POST /corrections/{id}/resolve`.

Template, configuration and reference-data routes are implemented and are
centralized in `src/lib/backend.js`.

Partner workspace routes are implemented through invitation acceptance at
`POST /auth/partner-invitations/{token}/accept`, then `GET /partner/me`,
`GET /partner/agreements`, and the partner-scoped document download route.

The related UI either maps to implemented agreement data or clearly displays that backend support is pending.
