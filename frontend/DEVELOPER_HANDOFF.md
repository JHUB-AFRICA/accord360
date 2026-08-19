# Accord360 Developer Handoff

## Integration rule

Do not add a new frontend endpoint merely because a screen needs data. First confirm the route in `API_ENDPOINTS.md` or update the backend and the API reference together.

## Where to change API integration

All production calls belong in `src/lib/backend.js`. Add normalization in `src/lib/normalize.js` when backend field names should be transformed for presentation.

## Current page-to-API map

- Login: `/auth/login`, `/auth/me`
- Dashboard: `/dashboard/workspace`, `/dashboard/stats`
- Users: `/users`, `/users/champions`, `/users/{id}`
- Partners: `/partners`, `/partners/{id}` via client list lookup and `PUT`
- Agreements: `/agreements`, `/agreements/{id}`, `/agreements/{id}/transition`
- Documents: agreement document upload/list/download
- Corrections: agreement list/detail plus workflow transition history
- M&E: agreement detail, deliverables, values and evidence upload
- Notifications: `/notifications`, `/notifications/{id}/read`
- Reports: dashboard statistics, agreement CSV and audit report
- Scorecards: frontend calculation from agreement detail
- Configuration/templates: no API calls until backend support exists

## Verification before merging

```powershell
npm ci
npm run validate
npm run syntax
npm run test:mock
npm run build
```

Also run the live backend and verify:

1. `GET http://127.0.0.1:8000/health`
2. Login for every backend role.
3. Dashboard workspace and stats.
4. Agreement filters with `agreement_type`.
5. Department → Linkages → Legal → DVC → VC → signing → activation.
6. Multipart uploads and token-authenticated downloads.
7. Deliverable/value updates.
8. Notifications and CSV/audit reports.

A 404 means the frontend called a route that is not implemented. A 401 indicates missing/expired authentication. A 403 indicates the server rejected the role or record scope.
