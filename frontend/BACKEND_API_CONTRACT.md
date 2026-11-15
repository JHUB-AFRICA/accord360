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
| Template library | `GET /templates`, `GET /templates/fields`, `POST /templates`, `POST /templates/{template_id}/activate`, `POST /templates/{template_id}/deactivate`, `GET /templates/{template_id}/download` |
| Configuration | `GET/POST /configuration`, `PATCH /configuration/{key}` |
| Reference data | `GET /reference-data`, `POST/PATCH /reference-data` |
| Perform workflow action | `POST /agreements/{agreement_id}/transition` with `{ action, comment }` |
| Filter agreement type | Query parameter `agreement_type` |
| User and record IDs | Integers |
| Audit report | `GET /reports/audit` |
| Agreement export | `GET /reports/agreements.csv` |
| Portfolio report | `GET /reports/portfolio` |
| Researcher progress update | `POST /agreements/{agreement_id}/progress-updates` |
| M&E progress read view | `GET /progress-updates` |
| Generated reports | `GET /reports/export.pdf`, `GET /reports/export.xlsx`, `POST /reports/ai-summary` |
| Google Drive access health | `GET /agreements/{id}/drive-access` |
| Google Drive access repair | `POST /agreements/{id}/drive-access/reconcile` (Linkages only) |
| Notification timeline | `GET /notifications` with cursor, unread, and category filters |
| Notification unread count | `GET /notifications/unread-count` |
| Notification read state | `POST /notifications/{id}/read`, `POST /notifications/{id}/unread`, `POST /notifications/read-all` |

## Agreement type values

The current backend accepts only:

- `MoU`
- `CRA`
- `CA`
- `Other`

The frontend does not submit `MoA` until the backend schema is changed.

## Role-scoped Phase 4 UI

The authenticated UI exposes four workspaces only: `researcher`, `linkages`,
`legal`, and `me`.

- Researcher: own agreements, dynamic FieldDefinition-driven intake, and
  quarterly progress notes for fully executed or expired agreements. No file
  upload controls are rendered.
- Linkages: all agreements, template management, placeholder validation,
  authoring guide, corrected drafts, and signing workflow.
- Legal: all agreements and version-scoped comments. No file upload controls
  are rendered or authorized.
- M&E: portfolio progress/expiry view and Update/Archive actions only for
  expired agreements.

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

The general agreement-version upload flow is restricted by the backend status
matrix. Legal is never an upload role. Linkages handles legal draft, corrected
draft and final signed uploads through the version endpoint; the Researcher
intake form does not accept files.

Where a legacy document endpoint remains available, the frontend sends
`FormData` with:

- `file`
- `document_type`
- `version`
- `confidentiality`
- `is_official`

It does not set `Content-Type` manually, allowing the browser to supply the multipart boundary.

## Physical signing flow

After Legal approval, Linkages may download the unchanged signing copy with:

- `GET /agreements/{agreement_id}/signing-copy?format=pdf`
- `GET /agreements/{agreement_id}/signing-copy?format=docx`

The authenticated backend verifies the Google Doc has not changed since Legal's
approval. Linkages uploads the physically signed file through
`POST /agreements/{agreement_id}/versions`; only PDF and DOCX files up to 25 MiB
are accepted. The resulting immutable version is downloaded through
`GET /agreements/{agreement_id}/versions/{version_id}/download` by Linkages,
Legal, M&E, and the owning Researcher.

## Unsupported backend capabilities

No production request is sent to:

- `/dashboard`
- `/directory/researchers`
- `/auth/forgot-password`
- `/auth/register-partner`
- `/me/reports`
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
