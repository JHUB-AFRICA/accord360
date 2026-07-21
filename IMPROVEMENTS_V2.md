# Accord 360 — Supervisor Baseline Improvement Batch

This update aligns the working MVP more closely with the stakeholder briefing **From Agreements to Accountable Partnerships**. It does not add a public landing page; authenticated users open directly into their controlled workspace.

## Completed in this batch

- Role-specific dashboard titles, navigation channels and priority work queues
- Eight-stage lifecycle visualization aligned to the validated operating model
- Stage timers and legal-review SLA indicators
- Portfolio filters for department and agreement type
- Four automated guardrail counters:
  - Legal review over 21 days
  - Six-month proactive renewal window
  - 180-day M&E dormancy
  - Critical expiry within 90 days
- Dedicated Monitoring & Evaluation portfolio page
- Target-attainment, evidence-count and last-update visibility
- Deliverable actual-value updates and M&E evidence workflow
- Required reasons for return and rejection actions
- Secure authenticated document downloads instead of publicly exposed upload URLs
- Role-scoped agreement exports and stricter backend authorization
- Admin-only user and settings routes
- Mobile overflow and responsive layout hardening

## Database compatibility

No existing table columns were changed, so an existing local SQLite database can continue to be used. Restart the backend after replacing the code.

## Verification completed

- Backend Python compilation passed
- Backend smoke tests: `2 passed`
- Administrator login, dashboard, agreements, monitoring and audit endpoints tested
- Frontend Vite production build completed successfully
