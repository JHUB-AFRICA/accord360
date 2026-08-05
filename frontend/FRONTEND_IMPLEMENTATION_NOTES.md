# Frontend Implementation Notes

## Final corrections incorporated

- One canonical 17-stage lifecycle is used throughout.
- DVC RPE endorsement and VC execution are separate workspaces and actions.
- Navigation is generated per role; generic all-module sidebars were removed.
- External partners have post-registration self-service screens.
- Corrections are structured and linked to exact items.
- Legal approval is blocked by unresolved blocking comments.
- Administrators cannot perform operational approvals.
- Six-month M&E reports support draft, submission, structured return and Linkages/M&E validation.
- Activation requires effective/expiry dates, a Champion, partner liaison, initial deliverable and completed signing gates.
- Versioned scorecards are included and score weights are validated to exactly 100%.
- The AI report uses a human-review disclaimer rather than an absolute accuracy claim.
- CA remains configurable and is not assigned a conflicting official definition.
- Synthetic demonstration records are consistent and labeled as prototype data.
- Responsive tables become labeled cards on small screens.
- Password-reset requests, notification resend, PDF/Excel/CSV report export controls and template administration are wired to the documented API.
- Loading, empty, error, access-denied, modal-confirmation and notification states are implemented.

## Integration boundary

The frontend is complete as an interactive implementation using explicit mock mode. Switching `VITE_USE_MOCK_API=false` changes all data calls to the real backend. The backend developer’s remaining work is to implement and authorize the endpoints documented in `BACKEND_API_CONTRACT.md`.

No frontend code should be modified to bypass missing backend permissions. The backend must be the authoritative source for roles, scopes, workflow transitions, document locks and audit records.
