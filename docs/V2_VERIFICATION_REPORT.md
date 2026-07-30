> **Historical note:** This document describes an earlier build. Role-based routing, DVC RPE and VC Office gates were added in the v1.2 release. See `ROLE_BASED_WORKSPACES.md` and `../RELEASE_NOTES_ROLE_BASED.md` for the current implementation.

# Accord360 Verification Against JKUAT Linkages Requirements + Wireframes v2.0

**Reviewed project:** `Accord360_Requirements_Aligned_Update.zip`  
**Reference:** `JHUB_Africa_Linkages_Complete_Website_Requirements_Wireframes_v2.docx` (Version 2.0, 21 July 2026)

## Verification verdict

The updated Accord360 project **cannot be confirmed as fully compliant with Version 2.0**. It is a functioning core workflow MVP aligned mainly with the earlier BRD, with useful security, lifecycle, dashboard, M&E deliverable and risk-control improvements. However, Version 2.0 adds mandatory Champion, partner-intake, template, Legal feedback, DVC RPE, VC package, six-month M&E report, scorecard, chatbot and configurable-governance capabilities that are not yet implemented.

**Release classification:** Phase 1 core workflow plus partial Phase 2/3 capabilities; **not ready for Version 2.0 UAT or production acceptance**.

### Coverage summary

| Area | Met/Present | Partial | Missing | Total |
|---|---:|---:|---:|---:|
| Mandatory functional requirements | 3 | 22 | 15 | 40 |
| Non-functional requirements | 2 | 5 | 3 | 10 |
| Acceptance scenarios | 0 | 6 | 6 | 12 |
| Wireframe/screen coverage | 2 | 10 | 5 | 17 |

## Mandatory functional requirement matrix

| ID | Capability | Status | Code finding |
|---|---|---|---|
| FR-001 | Champion role/type | Partial | Uses researcher/owner and free-text internal_champion; no Champion type or partner-side Champion model. |
| FR-002 | Champion gate for partner requests | Missing | No partner-originated request state or server-side gate requiring a JKUAT Champion before drafting. |
| FR-003 | Assign/reassign/deactivate Champion | Missing | No Champion assignment entity, reasoned reassignment/deactivation action, or assignment notification workflow. |
| FR-004 | Partner request intake | Partial | Linkages can create partners and agreements, but request source, partner category/county and dedicated partner-intake workflow are absent. |
| FR-005 | Step-by-step request wizard | Partial | A structured single-page form exists, but it is not a persisted multi-step wizard. |
| FR-006 | Required request fields/documents | Partial | Captures type, partner, department, alignment, outcomes and attachments; missing source and risk notes, with partner category not snapshotted on the request. |
| FR-007 | Configurable template library | Missing | No template model, category-based template selector, approval workflow or generation service. |
| FR-008 | Preserve selected template version | Missing | Document uploads have a version field, but no selected template/version relationship is recorded on a draft. |
| FR-009 | Complete draft metadata | Partial | Draft documents store version, uploader and time; checksum, draft status and review-comment relationship are absent. |
| FR-010 | Protect draft history | Partial | There is no ordinary delete endpoint, but no governed administrative correction/amendment process is implemented. |
| FR-011 | Legal workspace | Partial | Legal users can access legal-stage records, upload files and approve/return through the generic detail page; no dedicated feedback-thread workspace. |
| FR-012 | Shared legal feedback | Partial | Transition comments/history are visible to authorized users, but there is no structured legal feedback thread linked to draft versions. |
| FR-013 | Legal SLA days and stalled flag | Partial | Days in legal and a 21-day red status are implemented; the SLA is hard-coded rather than configurable. |
| FR-014 | Legal approval record/version | Partial | Workflow actor/time and audit are captured, but approval is not linked to the exact approved draft version. |
| FR-015 | DVC RPE post-legal sign-off | Missing | No DVC RPE role, queue, sign-off action or prerequisite check exists. |
| FR-016 | VC package dual gate | Missing | No server-side Legal + DVC RPE gate or distinct VC package-completion state. |
| FR-017 | VC submission package | Missing | No package assembly/generation for draft, approvals, brief, memo and supporting documents. |
| FR-018 | Full signing tracker | Partial | Tracks date sent to VC, date sent to partner, one signing date and final signed upload; lacks separate VC signature, partner signature and ceremony dates. |
| FR-019 | Activation prerequisites | Met | Server-side activation requires an official signed document and valid effective/expiry dates, plus additional M&E ownership controls. |
| FR-020 | Searchable repository | Partial | Role-scoped document access exists inside each agreement; no cross-record document repository/full-text search. |
| FR-021 | Six-month M&E schedules | Missing | Activation does not create recurring M&E schedule records or due notifications. |
| FR-022 | Champion activity report | Partial | Researchers can update deliverables, but no six-month report object, draft/submission state or submission to Linkages. |
| FR-023 | Targets and actuals | Met | Deliverable types, targets, actuals, periods and configurable free-text types are supported. |
| FR-024 | Evidence per report/deliverable | Partial | Backend supports an evidence document ID per deliverable; the current UI does not attach evidence during deliverable entry and there is no report-period entity. |
| FR-025 | Linkages M&E validation | Missing | No approve/return/query workflow for submitted Champion reports. |
| FR-026 | Adjustable score weights | Missing | No score configuration or calculation service. |
| FR-027 | Multi-source score | Missing | No Champion/Linkages/system-signal score components. |
| FR-028 | Score audit/version/tier | Missing | No score result or configuration-version model. |
| FR-029 | Executive KPIs | Met | Dashboard provides active, pipeline, at-risk and approved value by currency. |
| FR-030 | Executive dashboard filters | Missing | Dashboard endpoint has no requested filter set for partner category, country/county, risk and period. |
| FR-031 | Table and Kanban lifecycle tracker | Partial | A table shows partner, type, department, stage, status and next action; no Kanban, general days-in-stage or complete SLA fields. |
| FR-032 | Expiry alerts and renewal tasks | Partial | Six-month expiry risk status is computed, but no scheduled alert/task is created for Champion and Linkages. |
| FR-033 | Dormancy alerts | Partial | 180-day dormancy status logic exists, but no notification/escalation is generated by a scheduler. |
| FR-034 | Legal stalled alerts | Partial | 21-day stalled status exists, but no configured alert/escalation event is generated. |
| FR-035 | In-app/email/configurable escalation | Partial | In-app transition notifications exist; email, scheduled alert delivery and admin escalation configuration do not. |
| FR-036 | Chatbot Q&A | Missing | No chatbot UI or API. |
| FR-037 | Chatbot knowledge/guardrails | Missing | No approved FAQ knowledge base or authorization/legal-advice guardrails. |
| FR-038 | Admin configuration | Partial | User/role administration exists; templates, categories, weights, SLAs, notification rules and chatbot FAQ are placeholders. |
| FR-039 | Significant-event audit | Partial | Existing CRUD/workflow/document/M&E/export actions are audited, but absent v2 modules cannot produce required assignment, DVC, score and configuration events. |
| FR-040 | PDF/Excel report suite | Partial | Only a scoped CSV agreement register is implemented; dashboard, M&E, scorecard and PDF/Excel exports are absent. |

## Non-functional requirement matrix

| ID | Area | Status | Finding |
|---|---|---|---|
| NFR-001 | Performance | Partial / unverified | No load/performance test or agreed threshold evidence. |
| NFR-002 | Availability/DR | Missing | No backup, restore or disaster-recovery implementation/test. |
| NFR-003 | Server-side RBAC | Met | Authenticated API dependencies and server-side role/record scope checks are implemented. |
| NFR-004 | Confidentiality | Met for current modules | Protected downloads and confidentiality filtering are implemented for agreement documents. |
| NFR-005 | Integrity | Partial | Workflow/status prerequisites and audit logs exist, but v2 DVC/VC gates and tamper-evident audit design are absent. |
| NFR-006 | Accessibility | Partial / unverified | Labels and text statuses exist, but no WCAG/keyboard/screen-reader audit was provided. |
| NFR-007 | Responsive design | Partial / unverified | Responsive CSS breakpoints exist; required mobile task/M&E/chatbot flows were not built or visually QA-tested. |
| NFR-008 | Configuration without deployment | Missing | Most v2 configuration remains hard-coded or placeholder-only. |
| NFR-009 | Searchability | Partial | Searches title/reference/partner and filters some metadata; missing Champion, expiry and document keyword search. |
| NFR-010 | Audit retention/protection | Missing | No retention policy enforcement, append-only/tamper-evident storage or archival controls. |

## Acceptance scenario verification

| Test | Scenario | Result |
|---|---|---|
| AT-001 | Partner request logged and blocked pending Champion | Partial |
| AT-002 | Champion assignment notification/status/audit | Missing |
| AT-003 | Manufacturing template recommendation/version | Missing |
| AT-004 | Legal comments, revised draft and history | Partial |
| AT-005 | Block VC submission before Legal approval | Partial (old signing gate only; no VC package/DVC model) |
| AT-006 | Legal approval + DVC sign-off unlocks VC package | Missing |
| AT-007 | Activation creates six-month M&E schedule | Partial (activation controls met; schedule missing) |
| AT-008 | Due alert and overdue escalation | Missing |
| AT-009 | M&E report validation refreshes score/dashboard | Partial (deliverables exist; report validation/score missing) |
| AT-010 | Versioned 100% score-weight configuration | Missing |
| AT-011 | Guarded FAQ chatbot | Missing |
| AT-012 | Legal SLA raises alert and escalation | Partial (red status exists; alert/escalation missing) |

## Wireframe/screen coverage

| Frame | Required screen | Coverage |
|---|---|---|
| WF-01 | Public Landing | Missing |
| WF-02 | Login and Role Routing | Partial |
| WF-03 | Champion Dashboard | Partial |
| WF-04 | Partner Request Logging | Missing |
| WF-05 | New Request Wizard and Templates | Partial |
| WF-06 | Agreement Detail and Lifecycle | Present |
| WF-07 | Legal Workspace | Partial |
| WF-08 | DVC RPE Sign-Off Gate | Missing |
| WF-09 | VC Submission and Signing | Partial |
| WF-10 | Executive KPI Dashboard | Present |
| WF-11 | Lifecycle Tracker | Partial |
| WF-12 | M&E Reporting | Partial |
| WF-13 | Collaboration Scorecard | Missing |
| WF-14 | Alerts Center | Partial |
| WF-15 | Responsive Mobile Frames | Partial / unverified |
| WF-16 | Admin Console | Partial |
| WF-17 | Chatbot Help | Missing |

## Verification executed

- The updated ZIP was freshly extracted and its backend models, schemas, routers, access controls, services, tests and frontend routes/pages were inspected.
- Backend automated tests: **8 passed** (`python -m pytest -q`).
- The frontend production build was attempted. `npm ci` could not complete because the execution environment’s internal npm mirror returned a 404 for the Vite tarball. This is an environment/package-fetch limitation, so a successful production bundle is **not confirmed** by this review.
- Existing tests validate login/dashboard, partner/agreement creation, record scoping, scoped exports, activation prerequisites, dormancy logic and confidential document access. They do **not** cover the Version 2.0 acceptance tests AT-001 through AT-012.

## Required next code update

1. Replace the generic `researcher` ownership concept with a Champion domain model and add partner-originated intake plus assignment/reassignment actions.
2. Add configurable partner categories, template/version entities, draft checksums/statuses and version-linked Legal feedback threads.
3. Introduce Legal-approved-version, DVC RPE sign-off and VC package/signing entities with server-side gates.
4. Add six-month M&E schedule/report entities, due/overdue jobs, Champion submission and Linkages validation workflow.
5. Implement versioned score configuration/results, the approved 100-point weight model and executive score filters.
6. Add email delivery/escalation configuration, public landing, dedicated role workspaces, alerts center, chatbot FAQ/guardrails and the missing wireframe screens.
7. Add Alembic migrations, background scheduler/worker, upload malware scanning, backup/restore, audit retention and Version 2.0 automated acceptance tests.

## Final confirmation statement

The project is a valid **core MVP**, but it is **not the complete Version 2.0 Linkages Agreement Lifecycle and Performance Management System** described by the new requirements and wireframes. A further implementation cycle is required before formal stakeholder confirmation or UAT sign-off.