# Requirements Traceability Summary

Status meanings: **Implemented** = covered and verified in the current code; **Partial** = useful MVP coverage but material BRD elements remain; **Backlog** = not yet implemented.

| BRD/SRS capability | Status | Current implementation / remaining work |
|---|---|---|
| Secure researcher submission | Implemented | `AgreementForm.jsx`, `POST /api/agreements`, unique persisted-ID reference |
| Personalized progress tracking | Implemented | Scoped register/detail, stage, status, next action, legal days and expiry days |
| Partner registry | Partial | Partner records exist; duplicate-resolution and full history remain |
| Department/faculty approval | Implemented | Scoped approver access and controlled `approve_department` transition |
| Linkages review | Implemented | Separate `approve_linkages` and `send_legal` controls |
| Legal review workspace | Partial | Role scope, reviewer fields, version metadata and SLA state exist; comments workspace/clause tools remain |
| Draft version control | Partial | Document versions and official flags exist; richer comparison/approval workflow remains |
| Signing and activation | Implemented | Ordered status controls and activation prerequisites enforced |
| Lifecycle tracker | Implemented | Register and detail views expose stage, status, color, owner and next action |
| Executive KPI dashboard | Partial | Active, pipeline, risk, stage/type and currency-separated values; drill-down and full trend set remain |
| M&E targets, actuals and evidence | Partial | Deliverables and evidence linkage supported; reporting schedules and richer evidence workflow remain |
| Dormancy and expiry guardrails | Implemented | 180-day dormancy, six-month warning, 90-day critical expiry and 21-day legal SLA |
| Notifications and escalations | Partial | In-app workflow notifications exist; scheduled checks, email and escalation hierarchy remain |
| Controlled document repository | Implemented | Authenticated downloads, confidentiality scope, official versions and audit |
| Reports and exports | Partial | Scoped, filtered, timestamped CSV; full PDF/XLSX report catalogue remains |
| Role-based access control | Implemented | Centralized organizational and record scope for core modules |
| Audit trail | Partial | Material actions are logged; tamper-evident storage/retention enforcement remains |
| Administration/configuration | Backlog | User administration exists; templates, SLAs, workflows, categories and alerts need governed configuration |
| Template and clause library | Backlog | No controlled template generation or clause library yet |
| SSO, e-signature, ERP and BI integration | Backlog | Architecture remains integration-ready only |
| Historical migration | Backlog | Migration templates, deduplication and reconciliation are not implemented |
| Performance, availability and recovery | Partial | Basic health endpoint/Docker deployment; formal load tests, monitoring, backups and RTO remain |
| Accessibility and usability verification | Partial | Responsive UI exists; formal WCAG/keyboard/screen-reader testing remains |

See `docs/REQUIREMENTS_GAP_ANALYSIS.md` for the full findings and prioritized backlog.
