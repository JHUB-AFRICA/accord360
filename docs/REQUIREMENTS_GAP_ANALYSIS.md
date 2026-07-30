> **Historical note:** This document describes an earlier build. Role-based routing, DVC RPE and VC Office gates were added in the v1.2 release. See `ROLE_BASED_WORKSPACES.md` and `../RELEASE_NOTES_ROLE_BASED.md` for the current implementation.

# Accord360 Requirements and Code Gap Analysis

**Baseline sources reviewed**

- *MoU / CRA / CA Management System and Partnership Performance Dashboard* — BRD/SRS v1.0, 10 July 2026.
- *From Agreements to Accountable Partnerships* — stakeholder validation presentation.
- Accord360 full-stack source code supplied with the project.

## 1. Product interpretation

The two requirements artifacts describe Accord360 as an **institutional workflow and intelligence platform**, not a document register. The intended operating model has three connected responsibilities:

1. **Govern the process** — controlled initiation, department/faculty approval, Linkages review, legal vetting, signing, activation, renewal, closure and archival.
2. **Operate the lifecycle** — give each record a stage, owner, next action, SLA state, controlled document history and role-specific workspace.
3. **Measure the partnership** — connect signed agreements to champions, partner liaisons, targets, actual outputs, evidence, value records, risk alerts and executive reporting.

The presentation reinforces this through role-specific experiences, an eight-stage lifecycle, a modular architecture, an executive portfolio view and automated guardrails.

## 2. Required lifecycle baseline

| Stage | Required owner/control | Required exit condition |
|---|---|---|
| Initiation | Researcher/initiator | Complete request, partner, purpose, type, alignment and attachments |
| Department/faculty approval | Scoped approver | Academic fit and departmental support decided |
| Linkages review | Linkages officer/director | Completeness and strategic fit confirmed |
| Legal review | Assigned legal reviewer | Draft vetted, comments resolved, approved version retained |
| Validation and signing | Linkages/VC office/partner | Dispatch dates, signature status and signed document recorded |
| Activation | Linkages | Effective/expiry dates, champion, liaison and M&E baseline complete |
| Monitoring and evaluation | Champion/M&E officer | Targets, actuals and evidence updated on reporting cycle |
| Renewal/closure/archive | Linkages/champion | Renewal decision, closure record or archival completed |

## 3. Code updates completed in this review

### 3.1 Centralized record access and least privilege

Added `backend/app/access.py` and applied role/organizational scope across agreements, dashboard, reports, documents, M&E and value records.

- Researchers are limited to records they own.
- Approvers are limited to assigned or departmental records.
- Legal reviewers are limited to assigned/legal-stage records.
- M&E users are limited to implementation-relevant stages.
- Confidential document access is separately evaluated.
- Cross-record M&E and report access is blocked.

### 3.2 Secure document repository

The public `/uploads` static mount and Nginx proxy were removed. Documents now use an authenticated download route:

`GET /api/agreements/{agreement_id}/documents/{document_id}/download`

Additional controls include:

- agreement-scope checks;
- confidentiality enforcement;
- official-version permissions;
- one official document per document type;
- 25 MB limit and extension allow-list;
- download audit entries;
- stored server filenames removed from API responses.

### 3.3 Workflow sequencing and activation controls

Workflow transitions now require both the correct stage and the correct prior status. In particular:

- Linkages approval no longer skips directly into Legal review;
- `approve_linkages` and `send_legal` are separate controlled actions;
- signing actions cannot be executed out of sequence;
- correction, rejection and closure actions require a reason;
- activation requires signing date, effective date, expiry date, internal champion, partner liaison, an M&E deliverable baseline and an official signed agreement document;
- expiry must be later than the effective date.

### 3.4 SLA and risk guardrails

Risk logic now implements the presentation and BRD thresholds:

- legal review over 21 days: Red / stalled;
- expiry within approximately six months: Orange / renewal warning;
- expiry within 90 days: Red / critical expiry;
- no M&E activity for 180 days: Red / dormant.

The API also exposes `legal_review_days` and `days_to_expiry` for lifecycle views.

### 3.5 M&E and value controls

- Deliverable changes are restricted by role and lifecycle stage.
- Evidence document IDs must belong to the same agreement.
- M&E updates refresh agreement risk state.
- Value records are restricted to authorized implementation roles.
- Currency codes are normalized.
- Dashboard values are grouped by currency instead of incorrectly adding unlike currencies into one KES total.

### 3.6 Reporting and dashboard correctness

- Dashboard data uses the same record scope as the agreement register.
- Deliverables and value records are loaded for risk/KPI calculations.
- Six-month trend buckets use true calendar-month arithmetic.
- CSV export is scoped and supports stage, status, type, department, partner sector and expiry filters.
- Exports include generation time and applied-filter metadata.
- Export events are audited.

### 3.7 Deployment and maintainability hardening

- Replaced deprecated naive-UTC calls with a shared `utc_now()` helper.
- Added `ENVIRONMENT` and `SEED_DEMO_DATA` settings.
- Production startup rejects the default development secret or demo seeding.
- Frontend dependencies are pinned to the lock-file versions.
- Frontend Docker builds now use `npm ci`.
- Public-upload environment variables and proxy rules were removed.

### 3.8 Automated verification

The backend test suite now covers:

- authentication and dashboard access;
- partner/agreement creation and reference generation;
- cross-record read/edit/M&E denial;
- role-scoped CSV exports;
- activation prerequisite enforcement;
- 180-day dormancy behavior;
- absence of a public upload route.

## 4. Remaining gaps and recommended backlog

### Priority 1 — required before institutional UAT

| Gap | Current state | Recommended update |
|---|---|---|
| Template management | No controlled MoU/CRA/CA template workspace | Add template entity, approval state, owner, effective date, versioning and draft generation |
| Clause library | Not implemented | Add approved clause categories, versions and legal-only management |
| Configurable workflow/SLA rules | Core rules remain code constants | Move stages, thresholds, action roles and alert rules into governed configuration tables |
| Scheduled alerts | Notifications are event-driven only | Add scheduled worker for legal SLA, expiry, dormancy and M&E-due evaluations; integrate institutional email |
| Full report catalogue | CSV register only | Add pipeline, active, expiry, dormancy, legal SLA, M&E output, value and data-quality reports; support PDF/XLSX |
| Assignment workflow | IDs can be stored but assignment UX is limited | Add approver, Linkages and legal assignment controls with workload views and reassignment audit |
| Formal data migrations | `create_all()` is used | Introduce Alembic migrations before schema changes reach shared environments |
| Production file security | Authenticated local storage is improved but basic | Add malware scanning, encryption-at-rest decision, object storage policy, retention and disposal jobs |

### Priority 2 — enterprise hardening

| Gap | Recommended update |
|---|---|
| Tamper-evident audit trail | Add append-only controls, hash chaining or external immutable log storage |
| Observability | Add structured logs, error monitoring, metrics, health dependencies and alerting |
| Backup/recovery | Define RPO/RTO, automated backups and restoration tests |
| SSO and account lifecycle | Integrate the approved institutional identity provider and automated deprovisioning |
| E-signature and ERP/BI | Add only after interfaces and data ownership are approved |
| Historical migration | Build import templates, deduplication, validation and migration reconciliation reports |
| Performance targets | Load-test the 3-second screens, 5/15-second dashboard targets and expected concurrency |
| Accessibility | Conduct keyboard, focus, contrast, screen-reader and responsive-table testing |

### Priority 3 — product maturity

- Partner history and duplicate-resolution workflow.
- Delegated approver periods.
- Renewal decision forms and closure reports.
- Dashboard drill-down links that preserve filters.
- Data-quality scorecards for missing champions, contacts, expiry dates, deliverables and evidence.
- Configurable agreement types after official CRA and CA definitions are approved.
- Role-specific landing dashboards rather than one broadly shared dashboard.

## 5. Release recommendation

The supplied application is a credible workflow MVP, but the original version overstated alignment in several security and governance areas. The revised code materially improves record scoping, document protection, workflow sequencing, activation readiness, M&E risk logic, reporting scope and production safeguards.

It should be positioned as **Core Workflow MVP / pre-UAT**, not a production-complete enterprise platform. Institutional UAT should begin only after the Priority 1 backlog is either implemented or formally accepted as a phased exception.
