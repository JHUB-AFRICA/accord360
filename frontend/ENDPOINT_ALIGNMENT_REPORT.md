# Endpoint Alignment Report

The frontend has been audited against `API_ENDPOINTS.md`.

## Result

- Every production HTTP call is centralized in `src/lib/backend.js`.
- Every route in that file is documented as currently implemented.
- No production page calls configuration, templates, public partner registration, password reset, dedicated correction, scorecard, AI report, PDF, Excel, M&E report or notification-resend endpoints.
- UI routes such as `/corrections` and `/scorecards` remain normal React routes; they do not imply backend endpoints with the same name.

## Automated guard

`scripts/validate.mjs` fails when:

- a page bypasses the contract wrapper;
- an unsupported endpoint fragment is introduced;
- required implemented endpoints disappear;
- an unsupported partner role is added to role configuration;
- the environment defaults away from the documented API URL or enables mock mode by default.
