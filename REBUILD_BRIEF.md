# Accord 360 — Rebuild Brief (Source of Truth)

**Read this entire document before writing any code.** This document is the ONLY
source of truth for what to build. Where anything in the existing codebase
conflicts with this document, THIS DOCUMENT WINS — the existing code is what is
being corrected, not a reference to be preserved out of habit.

This brief was produced by auditing the current codebase against
`Accord360_Project_Specification.md.pdf` (the agreed spec from Linkages Office,
the real end users). If you have access to that PDF, treat it as the origin
document; this brief translates it into concrete, checkable engineering tasks.

## 0. Non-negotiable ground rules

1. There are **exactly four roles** in this system: `researcher`, `linkages`,
   `legal`, `me` (Monitoring & Evaluation). Do not invent, keep, or reference
   any other role (`admin`, `approver`, `director_linkages`, `dvc`,
   `vc_office`, `executive`, `auditor`, `partner`-as-a-login-role, etc.). If a
   capability seems to need an admin role, it belongs to `linkages` instead,
   unless this document says otherwise.
2. There are **exactly nine agreement statuses** (Section 2 below). Do not
   invent additional statuses, sub-statuses, or "stage" concepts distinct from
   status. Do not keep the old 17-stage / multi-stage-plus-status model.
3. Do not add speculative features, config flags, or abstractions beyond what
   is specified here. If something in this brief is silent on a topic, do not
   improvise — implement the narrowest thing that satisfies the explicit
   requirement and leave a `# TODO(spec):` comment citing the open question
   rather than guessing.
4. Every phase below ends with an **Acceptance Criteria** checklist. When a
   phase is complete, write a completion report (see Section 8, "Verification
   Protocol") — do not just say "done."
5. Do not delete git history or force-push. Removals described here are file
   deletions / code removals made as normal commits.
6. Work phase by phase, in order. Do not start Phase 3 work before Phase 1 and
   2 are complete and their acceptance criteria pass.

---

## 1. What gets removed (do this first, Phase 0)

Delete/strip the following. This is not optional cleanup — these represent a
rejected design (an 11-role, 17-stage institutional sign-off workflow) that
must not coexist with the new model, even behind a flag.

### Backend
- `backend/app/modules/workflows/service.py`: delete `STAGE_ORDER`,
  `TRANSITIONS`, and all status strings other than the nine listed in Section
  2 (`pending_department`, `linkages_approved`, `in_legal_review`,
  `legal_approved`, `dvc_approved`, `awaiting_vc_signature`,
  `awaiting_partner_signature`, `fully_signed`, `active`, `renewal_review`,
  `closed`, `rejected`, `legal_stalled`, `expiry_critical`, `dormant`,
  `expiry_warning` — all gone).
- Roles `admin`, `approver`, `director_linkages`, `dvc`, `vc_office`,
  `executive`, `auditor` — remove from `backend/app/seed.py` role list, from
  `app/access.py` permission checks, and from every router's
  `require_roles(...)` call.
- `Deliverable`, `ValueRecord`, `ScorecardDefinition`, `ScorecardSnapshot`
  models and their endpoints (`app/modules/workflows/me.py` scorecard logic,
  `frontend/src/pages/Scorecards.jsx`) — remove entirely. These are
  scope-creep; they are not in the spec. (Quarterly progress updates are a
  *different*, much simpler thing — see Section 4 `ProgressUpdate`.)
- `Correction` model — superseded by the new `Comment` model (Section 3). Do
  not keep both.
- `backend/app/modules/agreements/review.py` (the "data-review" / historical
  reconciliation subsystem) and its router — remove from the permanent app.
  If historical-data import is still needed as a one-off, it stays as a
  standalone CLI script (`backend/scripts/import_collaborations.py` may stay
  as a script, NOT as an in-app feature/route/page).
- `frontend/src/pages/HistoricalDataReview.jsx` and its route (`/data-review`)
  — remove.
- `frontend/src/pages/Users.jsx`, `Audit.jsx` (if admin-only), `Configuration.jsx`'s
  "scoring" tab — remove or fold what's still needed (template admin) into a
  `linkages`-owned screen (Section 5).
- All routes in `frontend/src/App.jsx` for `/approvals`, `/approvals/queue`,
  `/director`, `/dvc`, `/dvc/queue`, `/dvc/:id`, `/signing`, `/signing/queue`,
  `/signing/:id`, `/executive`, `/admin`, `/audit-workspace` — remove.
- `frontend/src/lib/workflow.js`: delete `WORKFLOW_STAGES` (17-entry list) and
  `ACTIONS`/`getAvailableActions()` as currently defined — replaced wholesale
  per Section 3.
- `frontend/src/lib/roles.js`: `ROLE_CONFIG` trimmed to exactly the four roles.

### Do NOT remove (explicitly confirmed reusable)
- Email provider abstraction: `backend/app/utils/email_service.py`.
- `notify_user` / `notify_roles` functions (rewire recipients, don't rewrite
  the mechanism) — `backend/app/modules/workflows/service.py`.
- `Notification` and `AuditLog` models.
- `WorkflowEvent` model — may be reused as the generic audit trail for status
  transitions.
- Shared `Dashboard.jsx` / `Agreements.jsx` table pattern.
- `RoleRoute.jsx`, `ProtectedRoute.jsx`, `RoleHomeRedirect.jsx` (just update
  the role lists passed into them).
- `AgreementForm.jsx` wizard shell (trim fields per Section 5, keep the
  structured-form-not-document-upload pattern).
- `Template` model's basic shape and its admin router (extend, don't
  replace).

---

## 2. Phase 1 — Roles, statuses, and core data model

### 2.1 Roles (exactly these four, these exact string values)
```
researcher   — proposes agreements, fills structured form, submits quarterly
             progress updates, sees ONLY their own agreements
linkages   — verifies partners, manages templates, generates/re-uploads
             drafts, coordinates physical signing, uploads final signed scan,
             sees ALL agreements
legal      — comments on drafts (never uploads files), verifies corrections,
             sees ALL agreements (same visibility as linkages)
me         — monitors progress updates, gets expiry alerts, can update or
             archive agreements that are in "Expired" status, sees all
             agreements' progress/status
```

### 2.2 Statuses (exactly these nine, exact string values, exact order)
```
draft_generated
pending_legal_review
returned_for_corrections
pending_legal_verification
approved_for_signing
awaiting_signatures
fully_executed
expired
archived
```

### 2.3 Status permission matrix (implement server-side as the single source
of truth — the frontend must derive visible actions from what the API allows,
never hardcode a duplicate matrix that can drift)

| Status | Who can upload a new document version | Who can comment |
|---|---|---|
| `draft_generated` | `linkages` (uploads the Linkages-prepared legal draft) | no one |
| `pending_legal_review` | no one (locked) | `legal` |
| `returned_for_corrections` | `linkages` | `legal` (view-only, cannot add new comments, can still resolve/re-open their own existing ones if you choose — default: view-only means read-only) |
| `pending_legal_verification` | no one (locked) | `legal` |
| `approved_for_signing` | no one (locked) | no one |
| `awaiting_signatures` | no one (locked, offline process) | no one |
| `fully_executed` | no one, ever (terminal, read-only) | no one, ever |
| `expired` | `me` (uploading here means initiating renewal — see 2.5) | no one |
| `archived` | no one (terminal) | no one |

### 2.4 Status transition sequence (implement exactly this graph, no other
edges)
```
draft_generated
  → pending_legal_review              [linkages, when the Linkages-prepared legal draft is uploaded]
pending_legal_review
  → returned_for_corrections          [legal requests changes]
  → approved_for_signing              [legal verifies, no changes needed — see 2.4a]
returned_for_corrections
  → pending_legal_verification        [linkages uploads corrected version]
pending_legal_verification
  → approved_for_signing              [legal verifies changes made, resolves comments]
  → returned_for_corrections          [legal requests more changes]
approved_for_signing
  → awaiting_signatures               [linkages starts physical signing process]
awaiting_signatures
  → fully_executed                    [linkages uploads final signed scan]
fully_executed
  → expired                           [system, automatic, when end_date passes without renewal]
expired
  → <back into an active status, e.g. pending_legal_review or approved_for_signing,
     per whatever renewal path you implement>   [me clicks "Update" / renewal in progress]
  → archived                          [me clicks "Archive"]
```
2.4a Note: the spec's canonical example path goes
`pending_legal_review → returned_for_corrections → pending_legal_verification
→ approved_for_signing`. A direct `pending_legal_review → approved_for_signing`
(no corrections needed) is a reasonable inferred edge but is NOT explicitly in
the spec — implement it, but mark it with a comment `# inferred edge, confirm
with Linkages Office` since it's not spelled out. Do not invent any other
edges beyond what's listed above.

2.5 The exact mechanics of "Expired → active again" (what status it lands on,
what data changes) are **not specified** in the source spec — it only says
M&E can "update" it, resetting into an active flow. Do not guess a full
renewal workflow. Implement the minimum: an `me`-only action that moves the
agreement from `expired` back to `approved_for_signing` (closest analog to
"renewal in progress") and updates `end_date`/`expiry_alert_date`. Leave a
`# TODO(spec): confirm exact renewal semantics with Linkages Office` comment.

### 2.6 Data model — exact fields, exact types

```
Agreement
  id
  title: string
  partner: FK → Partner (or partner_name string if no Partner table is kept)
  department: string
  researcher: FK → User (role=researcher)
  status: enum, one of the 9 values in 2.2
  start_date: date
  end_date: date
  expiry_alert_date: date, nullable       # computed once, see Phase 4
  expiry_notified: boolean, default false
  archived: boolean, default false        # NOTE: also has status "archived" —
                                           # keep both: `archived` bool tracks
                                           # M&E's terminal action distinctly
                                           # from the status enum for querying
                                           # convenience, but status is the
                                           # authoritative state
  created_at, updated_at: timestamp

AgreementVersion
  id
  agreement_id: FK → Agreement
  file: file reference (storage path/key)
  uploaded_by: FK → User
  timestamp: timestamp
  status_at_time: string (the Agreement.status value when this version was
                   created — a historical snapshot, not a live join)
  is_final: boolean, default false
  # INVARIANT: at most one AgreementVersion per Agreement has is_final=true,
  # and it is only ever set true on the version created during the
  # awaiting_signatures → fully_executed transition. Once true, that
  # Agreement can never get another AgreementVersion row.
  # INVARIANT: exactly one non-superseded ("current") version exists per
  # agreement at any time — the most recent by timestamp. Do not add a
  # separate "is_current" flag; derive current = MAX(timestamp) per
  # agreement_id, and label all others "superseded" in the UI.

Comment
  id
  version_id: FK → AgreementVersion
  author: FK → User (must have role=legal to create; enforce server-side)
  text: string
  status: enum('open', 'resolved'), default 'open'
  section_reference: string, nullable  # e.g. "Clause 4.2", free text
  timestamp: timestamp
  # Comments are scoped to a specific version. When a new version is
  # uploaded (Linkages corrects the draft), prior version's comments remain
  # visible under that superseded version's history but are not carried
  # forward or editable.

ProgressUpdate
  id
  agreement_id: FK → Agreement
  quarter: string (e.g. "2026-Q1")
  notes: text
  submitted_by: FK → User (must have role=researcher, and must be the
                agreement's own researcher — enforce server-side)
  created_at: timestamp
  # Only creatable when Agreement.status == 'fully_executed' or 'expired'.
  # Reject creation attempts otherwise with a clear 400 error.

Template
  id
  document_type: string (e.g. "Standard MoU")
  file: file reference
  is_active: boolean, default false
  # INVARIANT: at most one Template per document_type has is_active=true.
  # Activating one must atomically deactivate any other active Template of
  # the same document_type in the same transaction.
  uploaded_by: FK → User (must have role=linkages)
  timestamp: timestamp
  # Never hard-delete a Template row. "Deactivating" is the only removal
  # path; old versions stay queryable for audit.

FieldDefinition
  id
  field_name: string, unique  # the placeholder key, e.g. "partner_name"
                                # (stored WITHOUT the {{ }} wrapper)
  label: string               # human-readable label for the form, e.g.
                                # "Partner Organization Name"
  required: boolean, default true
  # This table is the single source of truth for: (a) which fields appear on
  # the Researcher's structured form, and (b) which {{tags}} are checked for
  # during template upload validation (Phase 2). Adding a new field to the
  # system = one row here + no other code change to merge/validation logic.
```

### 2.7 Visibility rules (enforce server-side in every list/detail query —
do not rely on frontend filtering alone)
```
researcher → only Agreements where Agreement.researcher == current_user
           (sees: their own proposal, all versions, comments read-only if any
           are visible to them — spec doesn't grant researcher comment
           visibility explicitly, default to: researcher can see the final
           signed AgreementVersion and their own ProgressUpdates; do not
           expose Legal's in-progress comments to Researcher — that's an
           internal Linkages/Legal conversation)
linkages → ALL agreements, all versions, all comments
legal    → ALL agreements, all versions, all comments (same as linkages)
me       → ALL agreements' status/progress data; ProgressUpdates; expiry
           fields. M&E does not need document-editing UI, only monitoring +
           the Expired-status actions.
```

### Phase 1 Acceptance Criteria
- [ ] Exactly 4 roles exist in the seed data and in every `require_roles(...)`
      call across the backend. `grep -rn "admin\|approver\|director_linkages\|dvc\|vc_office\|executive\|auditor"` in `backend/app` and `frontend/src` returns zero role-usage hits (comments referencing history are fine, code paths are not).
- [ ] Exactly 9 status strings exist anywhere status is compared/set. No
      `stage` column/concept remains on `Agreement`.
- [ ] All six new/changed tables (`Agreement` updated, `AgreementVersion`,
      `Comment`, `ProgressUpdate`, `Template` updated, `FieldDefinition`)
      exist via an Alembic migration, with the exact field names/types above.
- [ ] `Deliverable`, `ValueRecord`, `ScorecardDefinition`, `ScorecardSnapshot`,
      `Correction`, and the old `Document` model (superseded by
      `AgreementVersion`) are dropped or migrated, not left dangling
      unused in the schema.
- [ ] A unit test (or equivalent) proves: activating a Template deactivates
      any sibling active Template of the same document_type in one
      transaction.
- [ ] A unit test proves: only one AgreementVersion per Agreement can have
      is_final=true, and no further AgreementVersion can be created after one
      exists with is_final=true for that agreement.

---

## 3. Phase 2 — Document generation engine

This is the single most important missing capability. Currently nothing
merges Researcher form data into a template. Build this before anything else in
Phase 2/3.

### 3.1 Library
Add `docxtpl` (Python) to `backend/requirements.txt`. Do not use a different
merge library without flagging it — `docxtpl` is the spec's named
recommendation.

### 3.2 Flow (implement exactly this, no shortcuts)
1. Researcher fills a structured form on the frontend — one input per active
   `FieldDefinition` row (label + required flag drive the form; do not
   hardcode field names in the frontend).
2. Researcher submits → backend creates the `Agreement` row with
   `status = draft_generated` and notifies Linkages. This is the Linkages
   intake state; it is not yet Legal review.
3. Linkages reviews the system-generated document and prepares the actual
   agreement draft. Linkages uploads that draft through a dedicated version
   upload endpoint. The upload:
   a. creates the first `AgreementVersion` with `uploaded_by = linkages`,
      `status_at_time = draft_generated`, and `is_final = false`;
   b. transitions `Agreement.status` to `pending_legal_review`; and
   c. fires the "Draft ready → notify Legal" notification.
4. The system-generated Researcher document is retained as intake data/history;
   it is not sent to Legal as the legal draft. **Researcher never uploads a
   file at any point in this flow.** There must be
   no file-upload input rendered anywhere in the Researcher-facing form.

### 3.3 Template validation on upload (Linkages-facing)
When Linkages uploads a new `.docx` template (`POST /templates`):
1. Parse the `.docx` with `python-docx`, scan for `{{field_name}}` tokens.
2. Compare found tokens against all `FieldDefinition.field_name` rows.
3. Return a validation summary in the API response:
   `{ present: [...], missing_required: [...], unknown_tokens: [...] }`.
4. Do not hard-block upload on missing fields (Linkages should be able to
   save a draft template and fix it later), but the frontend must surface
   this summary clearly so Linkages can self-correct. Add a boolean
   `validated: bool` to the response object; a template with
   `missing_required` non-empty should not be activatable
   (`is_active=true`) — block *activation*, not upload.

### 3.4 Placeholder naming convention
`{{field_name}}` exactly, lowercase snake_case, matching `FieldDefinition.field_name`
verbatim (no `{{ field_name }}` with spaces — pick one convention, document it,
and enforce it consistently in both the merge code and the validation scan).

### Phase 2 Acceptance Criteria
- [ ] `docxtpl` and `python-docx` are in `backend/requirements.txt` and
      actually imported/used (not just declared).
- [ ] Submitting the Researcher form produces the system-generated intake
      document and routes the agreement to Linkages in `draft_generated`.
- [ ] Linkages can upload the actual agreement draft as a new version, which
      moves the agreement to `pending_legal_review` and notifies Legal.
- [ ] There is no code path where a `researcher`-role user can call a
      file-upload endpoint for a new `AgreementVersion`. Attempting it
      returns 403.
- [ ] Uploading a template missing a required placeholder returns the
      validation summary and prevents `is_active=true` on that template until
      fixed.
- [ ] The field list on the Researcher's form is generated dynamically from
      `FieldDefinition` rows, not hardcoded in frontend JSX.

---

## 4. Phase 3 — Legal comments, versioning, notifications, expiry

### 4.1 Legal comments
- Implement CRUD for `Comment` scoped to a `version_id`:
  `POST /versions/{id}/comments`, `PATCH /comments/{id}` (toggle
  open/resolved), `GET /versions/{id}/comments`.
- Only `legal` role can create comments. Only `legal` can resolve their own
  comments (or any comment — spec doesn't restrict to self-authored, default
  to: any `legal` user can resolve any open comment).
- Enforce the status matrix from Section 2.3: comment creation only allowed
  when the parent Agreement's current status is `pending_legal_review` or
  `pending_legal_verification`. During `returned_for_corrections`, existing
  comments are visible but read-only (no new comments, per the matrix).
- Legal has **no** file-upload endpoint access anywhere. Remove the
  `legal`-role grant from `documents.py`'s upload permission check
  (identified in the audit as currently allowed — this must be removed).

### 4.2 Linkages re-upload flow
- `POST /agreements/{id}/versions` restricted to `linkages` role, only
  callable when `Agreement.status == returned_for_corrections`.
- Creates a new `AgreementVersion` row (never overwrites), transitions status
  to `pending_legal_verification`, fires "Corrected draft resubmitted →
  notify Legal."

### 4.3 Signing flow
- `approved_for_signing → awaiting_signatures`: `linkages`-only action, no
  file involved (this step is offline — the system just records the status
  change and timestamp).
- `awaiting_signatures → fully_executed`: `linkages`-only action, requires a
  file upload (the scanned signed document). This creates the final
  `AgreementVersion` with `is_final = true`. After this call:
  - Reject any further `POST /agreements/{id}/versions` or comment-creation
    calls for this agreement (return 409/423 "agreement is fully executed and
    locked").
  - Fire "Fully executed → notify Legal, Researcher, M&E simultaneously" (all
    three, in one call — this was previously missing).
  - Compute and store `expiry_alert_date = end_date - relativedelta(months=6)`
    on the `Agreement` row, right here, once. Do not compute it elsewhere or
    recompute it later.

### 4.4 Expiry automation
- Add `python-dateutil` to `backend/requirements.txt`, use `relativedelta`
  for the 6-month calculation (not naive `timedelta(days=180)`).
- Add `apscheduler` to `backend/requirements.txt`.
- In `backend/app/main.py`, add a lifespan-hook-managed scheduled job that
  runs once daily:
  ```
  SELECT agreements WHERE expiry_alert_date <= today() AND expiry_notified = false
    → notify_roles(['me'], "Agreement approaching expiry")
    → set expiry_notified = true

  SELECT agreements WHERE end_date < today() AND status = 'fully_executed'
    → set status = 'expired'
    → notify_roles(['me'], "Agreement expired")
  ```
- This must be a **plain date comparison** against the precomputed
  `expiry_alert_date` — do not recompute days-remaining on every dashboard
  load. Remove the existing `refresh_risk_status()` side-effect-on-read
  pattern (identified in the audit as the anti-pattern the spec explicitly
  warns against) once this job replaces it.
- If the app may ever run multiple instances, add a simple "last run date"
  row/lock in the database that the job checks before running, to avoid
  duplicate notification emails. Implement this lock now (it's cheap) even
  if single-instance is the current deployment — flag it as
  `# TODO(spec): confirm deployment topology with team`, but include the lock.

### 4.5 Quarterly progress updates
- `POST /agreements/{id}/progress-updates`: `researcher`-only, only for their
  own agreement, only when status is `fully_executed` (or `expired` — an
  agreement can still be actively monitored while expired-pending-renewal).
  Reject with a clear error otherwise.
- `me` role gets a read endpoint/view listing all ProgressUpdates across all
  agreements — no separate reporting/aggregation logic needed beyond a plain
  list/filter query.

### 4.6 Full notification trigger table (implement exactly these seven, no
more, no fewer — verify each one fires by writing a test that asserts a
`Notification` row / email call happens on the transition)

| Trigger | Recipients |
|---|---|
| Draft generated (draft_generated → pending_legal_review) | `legal` |
| Legal requests changes (→ returned_for_corrections) | `linkages` |
| Corrected draft resubmitted (→ pending_legal_verification) | `legal` |
| Legal approves (→ approved_for_signing) | `linkages` |
| Fully executed (awaiting_signatures → fully_executed) | `legal`, `researcher` (this agreement's), `me` — all three, same event |
| Expiry approaching (expiry_alert_date reached) | `me` |
| Agreement expired (end_date passed) | `me` |

### Phase 3 Acceptance Criteria
- [ ] All 7 notification triggers in 4.6 are covered by a passing test that
      asserts the correct recipients were notified.
- [ ] `legal` role has zero file-upload permission anywhere in the codebase.
- [ ] `expiry_alert_date` is set exactly once, at the fully_executed
      transition, using `relativedelta`. Grep confirms no other write site.
- [ ] A daily APScheduler job exists in `main.py`'s lifespan, is observable in
      logs, and correctly flips `expired` status / sends the two expiry
      notifications based on stored fields only (no live recomputation of
      "days until expiry" driving any notification decision).
- [ ] `refresh_risk_status()` (or equivalent recompute-on-read logic) no
      longer exists, or if retained for a UI-only "days remaining" display
      badge, it has zero side effects (no DB writes, no notification calls).
- [ ] `ProgressUpdate` creation is rejected with a 400 for any agreement not
      in `fully_executed`/`expired` status, verified by a test.
- [ ] Once `is_final=true` exists on an agreement's version, both new-version
      upload and comment-creation endpoints return an error for that
      agreement, verified by a test.

---

## 5. Phase 4 — Frontend rebuild

### 5.1 Four role-scoped views only
- `researcher`: agreement list (own only), the structured proposal form
  (dynamic fields from `FieldDefinition`), agreement detail (read-only
  document + their own progress-update submission form once
  fully_executed/expired).
- `linkages`: shared filterable agreements table (all agreements — columns:
  partner, department, status, researcher, start/end date), agreement detail
  page (version history, comment thread read/participate, status action
  buttons per Section 2.3), template admin screen (upload/activate/deactivate
  templates, see validation summary from 3.3), a static "template authoring
  guide" page/panel listing all `FieldDefinition` rows and their `{{tag}}`
  syntax.
- `legal`: same shared agreements table as linkages (same component, same
  data — no separate query/page), agreement detail page with comment
  thread (create/resolve), no upload buttons rendered anywhere, no template
  admin access.
- `me`: agreements table filtered/focused on status + progress + expiry
  columns, progress-update read view, and action buttons for `Update` /
  `Archive` that only render when `Agreement.status == 'expired'`.

### 5.2 Action-button visibility
Do not hardcode a second copy of the permission matrix in the frontend.
Either (a) have the detail-page API response include an
`available_actions: string[]` field computed server-side from the current
user + agreement status (preferred), or (b) if computed client-side, the
logic must be a direct, literal transcription of the Section 2.3 table with
no additional conditions. Any divergence between frontend-rendered buttons
and backend-enforced permissions is a bug — the backend must reject
disallowed actions regardless of what the frontend shows (defense in depth,
frontend is not the security boundary).

### 5.3 Researcher form
Reuse `AgreementForm.jsx`'s wizard shell, but:
- Remove the manual file-upload step entirely.
- Remove the `template_id` manual-selection step — template selection is
  implicit (the system's active template for the relevant document_type is
  used automatically at generation time).
- Remove `confidentiality` and any other field not in `FieldDefinition` /
  the core `Agreement` fields listed in Section 2.6.
- Remove the code path that lets `linkages`/other roles use this same wizard
  to create agreements on a Researcher's behalf, unless the spec-referenced
  workflow explicitly requires it (it doesn't — Researcher self-initiates).

### Phase 4 Acceptance Criteria
- [ ] Exactly 4 top-level authenticated views/dashboards exist, one per role.
      No routes reachable for removed roles.
- [ ] No file-upload `<input>` exists anywhere in a `researcher`-role-rendered
      page.
- [ ] No file-upload button/action renders anywhere in a `legal`-role-rendered
      page.
- [ ] `linkages` has a template management screen showing active/inactive
      templates per document_type and a visible validation summary on
      upload.
- [ ] A "template authoring guide" view exists, listing every
      `FieldDefinition.field_name` with its `{{...}}` syntax and label.
- [ ] `me`'s Update/Archive buttons render only on agreements with
      `status == 'expired'`, verified manually or via a component test.

---

## 6. Explicitly open / unresolved items — do not silently resolve these

These are flagged as undecided in the source spec. Do not invent an answer;
implement the minimum default noted, leave a `# TODO(spec)` comment, and list
them again in your completion report so a human can decide.

1. Should Linkages be required to view/acknowledge Legal's open comments
   before the "upload new version" button unlocks? — **Default: no gate,
   allow upload regardless of comment-acknowledgment state.**
2. Visual diff between draft versions — **Not required for this rebuild.**
   Do not build it.
3. How should an amendment to an already-signed (`fully_executed`) agreement
   be handled? — **Default: out of scope for this rebuild.** Do not add an
   "edit signed agreement" path of any kind. If asked, the recommended future
   design is a separate `Addendum` record, not a new `AgreementVersion` on
   the original.
4. Production email provider (SendGrid/Mailgun/SES/SMTP) — **Default: keep
   the existing provider abstraction and current providers (SMTP, Resend,
   console). Do not remove Resend. Do not add SendGrid/Mailgun/SES unless
   asked.**
5. Single vs. multi-instance deployment (affects whether the scheduler lock
   in 4.4 is load-bearing) — **Default: implement the lock anyway (cheap
   insurance), assume single-instance for now.**
6. What concretely happens when M&E clicks "Update" on an `Expired`
   agreement (Section 2.5)? Confirmed with Jason on 2026-09-20, still
   pending a real answer from Linkages Office at the next requirements
   meeting. Two things ARE confirmed and must be respected in the
   meantime:
   - An agreement sitting in `Expired` does **not** mean the collaboration
     is no longer wanted — it can sit there indefinitely while a renewal
     is slowly being worked out. Nothing should auto-archive it, add a
     time limit, or otherwise treat `Expired` as a countdown to deletion.
   - Archiving is **always** a deliberate, manual M&E action. Never
     archive an agreement automatically for any reason (age, inactivity,
     time since expiry, etc.) — only an explicit M&E "Archive" click may
     set `archived = true` / move status to `archived`.
   What's still unknown: what "Update" actually produces (does it collect
   new dates from the Researcher? does it route back through Legal review,
   or straight to a new active status? does it reset
   `expiry_alert_date`/`expiry_notified`, and how?). **Default until
   answered: keep the Phase 1 placeholder** (`expired → approved_for_signing`,
   with the existing `# TODO(spec)` comment in `agreements/service.py`) —
   do not build out a fuller renewal workflow on speculation.

---

## 7. Definition of Done (whole rebuild)

The rebuild is complete only when ALL FOUR phase acceptance-criteria
checklists (Sections 2, 3, 4, 5) pass, AND:
- [ ] Every item in Section 1 ("what gets removed") is confirmed removed —
      `grep` for each named symbol/file returns nothing in `app/` or `src/`.
- [ ] The full lifecycle (Section 2.4) can be walked end-to-end manually:
      researcher submits → draft auto-generated → legal comments → linkages
      corrects → legal approves → linkages marks awaiting signatures →
      linkages uploads signed scan → all three parties notified → expiry
      alert fires 6 months before end_date → agreement auto-expires → M&E
      updates or archives it.
- [ ] No role other than the four in Section 2.1 exists anywhere in seed
      data, auth checks, or UI.

## 8. Verification protocol (for the human reviewer — Jason)

When a coding agent reports a phase (or the whole rebuild) complete, it must
produce a report in this exact format so it can be checked against this
document line by line:

```
## Phase X completion report

For each numbered/checklist item in this brief's Phase X:
- [x or ] <item text, copied verbatim>
  → file(s): <path:line>
  → how verified: <test name / manual step / grep command run>

## Deviations
<any place the implementation differs from this brief, and why>

## Open items encountered
<any Section 6 item that came up, or any new ambiguity found>
```

Do not accept "done" without this report. To verify, re-run the exact `grep`
commands and test names cited, don't just trust the prose.
