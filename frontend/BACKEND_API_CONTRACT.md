# Accord360 Frontend Integration Contract

The detailed source of truth is [`API_ENDPOINTS.md`](./API_ENDPOINTS.md). This document explains how the frontend uses that contract.

## Contract boundary

All real backend calls are implemented in `src/lib/backend.js`. UI pages import named functions from that module rather than assembling endpoint paths themselves.

## Exact naming corrections

| Frontend operation | Implemented backend route |
|---|---|
| Workspace dashboard | `GET /dashboard/workspace` |
| Portfolio statistics | `GET /dashboard/stats` |
| Champion directory | `GET /users/champions` |
| Update partner | `PUT /partners/{partner_id}` |
| Perform workflow action | `POST /agreements/{agreement_id}/transition` with `{ action, comment }` |
| Filter agreement type | Query parameter `agreement_type` |
| User and record IDs | Integers |
| Audit report | `GET /reports/audit` |
| Agreement export | `GET /reports/agreements.csv` |

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

## Unsupported backend capabilities

No production request is sent to:

- `/dashboard`
- `/configuration`
- `/templates`
- `/reference-data`
- `/directory/champions`
- `/corrections`
- `/scorecards`
- `/reports/portfolio`
- `/reports/ai-summary`
- `/reports/export.pdf`
- `/reports/export.xlsx`
- `/auth/forgot-password`
- `/auth/register-partner`
- `/me/reports`
- notification resend routes
- `/agreements/{id}/actions/{action}`

The related UI either maps to implemented agreement data or clearly displays that backend support is pending.
