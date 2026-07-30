> **Historical note:** This document describes an earlier build. Role-based routing, DVC RPE and VC Office gates were added in the v1.2 release. See `ROLE_BASED_WORKSPACES.md` and `../RELEASE_NOTES_ROLE_BASED.md` for the current implementation.

# Accord360 Code Update Summary

## Updated backend files

- `app/access.py` — centralized agreement, document, M&E and value authorization.
- `app/timeutils.py` — shared UTC timestamp helper.
- `app/models.py` — UTC defaults plus legal-review and expiry age properties.
- `app/schemas.py` — validation and safer document output.
- `app/services.py` — ordered workflow states and 21/90/180-day risk rules.
- `app/routers/agreements.py` — scoped reads/edits, transition prerequisites and activation gates.
- `app/routers/documents.py` — authenticated downloads and confidentiality/official-version controls.
- `app/routers/me.py` — scoped M&E/value changes and evidence validation.
- `app/routers/dashboard.py` — scoped KPIs, correct calendar trends and currency-separated values.
- `app/routers/reports.py` — scoped/filtered/timestamped CSV export with audit logging.
- `app/config.py`, `app/main.py`, `app/seed.py` — production startup safeguards and optional demo seeding.

## Updated frontend files

- `src/lib/api.js` — authenticated file-download helper.
- `src/pages/AgreementDetail.jsx` — secure document downloads, role/stage-sensitive forms and ordered workflow buttons.
- `src/pages/AgreementForm.jsx` — supporting attachments at request creation.
- `src/pages/Dashboard.jsx` — role-aware new-request action and currency-separated value display.
- `src/pages/Agreements.jsx`, `Users.jsx`, `Partners.jsx` — role-aware actions.
- `Dockerfile`, `nginx.conf`, `.env.example`, `package.json`, `package-lock.json` — reproducible dependencies and removal of public upload routing.

## Verification

- Backend: **8 tests passed**.
- Python compile check: passed.
- JSX syntax check using the installed TypeScript parser: passed.
- Full frontend dependency installation/build could not be executed in the working environment because its internal npm mirror returned 404 for the Vite package. The lock file has been normalized to public npm registry URLs for normal external environments.
