# Requirements Traceability Summary

| BRD capability | Implementation location |
|---|---|
| Secure researcher submission | `frontend/src/pages/AgreementForm.jsx`, `POST /api/agreements` |
| Personalized tracking | Agreements list/detail with role scoping |
| Partner records | Partners page and `/api/partners` |
| Department approval | Workflow transition `approve_department` |
| Linkages review | `approve_linkages` and `send_legal` transitions |
| Legal review | Legal role, legal stage, SLA risk calculation |
| Signing and activation | Signing dates, signed status, activation validation |
| Lifecycle tracker | Agreements page, stage/status/next-action fields |
| Executive KPIs | `/api/dashboard/stats`, dashboard KPI cards |
| M&E targets and actuals | Deliverables endpoints and agreement M&E tab |
| Value generated | Value records and dashboard total |
| Alerts and notifications | Notification model and workflow notifications |
| Expiry and legal risk colors | `refresh_risk_status` service |
| Document repository | Upload API, filesystem storage and document tab |
| Reports and exports | CSV endpoint and Reports page |
| Role-based access | JWT, role dependencies and scoped queries |
| Audit trail | Audit model, helper and audit report |
| Responsive layout | `frontend/src/styles.css` media queries |
| PostgreSQL deployment | `docker-compose.yml` |

