# Accord360 Frontend UI Update

This frontend-only update implements the refined Accord360 UI direction for the JKUAT Directorate of Linkages (RPE).

## Implemented

- Institutional navy and green design system.
- Strict role-specific navigation and dashboards.
- Canonical 17-stage agreement lifecycle.
- Controlled synthetic Accord360 demonstration data.
- Responsive agreement register and detail workspace.
- Six-step request wizard with autosave messaging.
- Exact correction traceability.
- Six-month M&E reporting and scorecards.
- Help Centre and permission-safe assistant interface.
- DVC RPE and VC Office role separation through dedicated dashboards.
- Administrator-only users, configuration and audit pages.
- Responsive desktop, tablet and mobile layouts.
- Frontend demo-login fallback when the backend is unavailable.

## Run

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`.

The login first attempts the configured backend. When the backend is unavailable, any seeded Accord360 demo email can open the appropriate role workspace. The password field must not be empty.

## Production note

The UI contains frontend demonstration data while the new backend endpoints are developed. Replace imports from `src/lib/demoData.js` with API responses as each backend module becomes available.
