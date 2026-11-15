# Accord 360 In-App Notifications — Swarm Implementation Brief

**Status:** implementation source of truth for the notification prototype
**Scope:** backend, frontend, mock mode, migrations, and tests for in-app notifications
**Primary goal:** replace workflow email dependence with a dependable, role-aware task inbox for the prototype

Agents must read this entire brief and the repository `AGENTS.md` before making changes. If code or an older working note conflicts with this brief, stop and ask the coordinator instead of silently choosing a direction.

## 1. Product outcome

The notification experience must tell a signed-in user:

1. what changed;
2. who caused it;
3. whether the item is informational or requires action;
4. what the user should do next; and
5. where to go to do it.

The prototype is a **task inbox**, not merely a chronological message list. Reading a notification and completing its required action are different states.

Success means a researcher, Linkages officer, Legal officer, or M&E officer can remain inside Accord 360 and reliably see a new assignment, open the correct agreement, perform the action, and see the task become resolved.

## 2. Frozen decisions

Agents must not revisit these decisions unless implementation is genuinely blocked.

- Transactional email is disabled for the prototype. Keep `EMAIL_ENABLED=false`. Do not configure Resend, SMTP, email templates, email webhooks, or email delivery status.
- An initial Google Drive sharing message to the **external partner only** is allowed because partners do not have Accord 360 accounts or an in-app inbox. This is an access-delivery exception, not the workflow notification system.
- Internal users must receive workflow handoffs in Accord 360, not through repeated Google Drive sharing emails.
- Preserve Drive permission grants and revocations. Do not weaken access control to simplify notifications.
- Do not introduce WebSockets, Server-Sent Events, browser push, service workers, or mobile push. Use REST plus 30-second polling and window-focus refresh.
- Do not create staff assignment functionality. The current Agreement model has no assigned Linkages, Legal, or M&E officer. For the prototype, notifications are shared role queues.
- Do not add notification preferences. Task-critical in-app notifications are mandatory.
- Do not build a general workflow/rules engine or administrator notification-rule editor.
- Do not redesign unrelated agreement, authentication, Google Docs, reporting, or dashboard features.
- Do not add a new state-management dependency unless the existing React tools cannot implement a shared notification provider.
- Keep the existing four roles and authorization boundary: `researcher`, `linkages`, `legal`, and `me`.
- Backend authorization is authoritative. Frontend hiding is never an access-control mechanism.

## 3. Current implementation that must be evolved

- Model: `backend/app/modules/workflows/models.py`
- Schemas: `backend/app/modules/workflows/schemas.py`
- Notification creation: `backend/app/modules/workflows/service.py`
- Notification API: `backend/app/modules/workflows/notifications.py`
- Workflow triggers: `backend/app/modules/agreements/service.py`
- Expiry triggers: `backend/app/modules/agreements/expiry.py`
- Frontend API wrapper: `frontend/src/lib/backend.js`
- Frontend normalization: `frontend/src/lib/normalize.js`
- Shared application shell/bell: `frontend/src/components/Layout.jsx`
- Notification page: `frontend/src/pages/Notifications.jsx`
- Mock backend: `frontend/src/lib/mockApi.js`
- Mock verification: `frontend/scripts/mock-smoke-test.mjs`

Agents must preserve the existing owner-only security rule: users can list and mutate only their own notification records.

## 4. Notification contract

The backend remains the source of truth. The frontend must not infer categories, severity, required actions, actors, or routes from title/message text.

Each notification must expose:

| Field | Required behavior |
| --- | --- |
| `id` | Stable integer identifier |
| `user_id` | Stored internally; do not use it to authorize on the frontend |
| `event_type` | Stable machine-readable event from the table in Section 5 |
| `category` | One of `action_required`, `status_update`, `deadline`, `system` |
| `severity` | One of `info`, `success`, `warning`, `critical` |
| `title` | Short human-readable summary |
| `message` | Plain-language context and next step |
| `actor_id` | Nullable FK for user-caused events |
| `actor_name` | Response field; `System` when no actor exists |
| `agreement_id` | Nullable related agreement |
| `agreement_title` | Response field when an agreement exists |
| `action_url` | Server-provided internal route, normally `/agreements/{id}` |
| `requires_action` | Whether the recipient/team is expected to act |
| `is_read` | Compatibility response field |
| `read_at` | Nullable timestamp; authoritative read time |
| `resolved_at` | Nullable timestamp for completed/no-longer-relevant tasks |
| `created_at` | Creation timestamp |
| `dedupe_key` | Nullable unique internal key preventing duplicate event/recipient rows |

### Read-state invariant

Keep `is_read` during this prototype for API/frontend compatibility, but all writes must preserve:

```text
is_read == (read_at is not null)
```

Migration backfill: existing rows with `is_read=true` receive `read_at=created_at`; unread rows retain `read_at=null`.

### Resolution behavior

- Reading never resolves an action.
- Completing the relevant workflow transition resolves the open action notifications for that agreement and shared recipient role.
- Because queues are role-shared, when one Linkages or Legal user completes the task, matching task notifications for the whole role are resolved.
- Resolved notifications remain visible in history.

## 5. Frozen event and recipient policy

Use a single backend policy/service for these definitions. Do not duplicate recipient rules or message templates across route functions.

| Event type | Trigger | Recipients | Category | Severity | Requires action |
| --- | --- | --- | --- | --- | --- |
| `agreement.submitted` | Researcher submits draft | All active Linkages users | `action_required` | `info` | Yes |
| `agreement.sent_to_legal` | Linkages sends to Legal | All active Legal users | `action_required` | `info` | Yes |
| `agreement.returned_to_linkages` | Legal returns it | All active Linkages users | `action_required` | `warning` | Yes |
| `agreement.returned_to_researcher` | Linkages returns it | Owning researcher only | `action_required` | `warning` | Yes |
| `agreement.resubmitted` | Researcher resubmits | All active Linkages users | `action_required` | `info` | Yes |
| `agreement.approved` | Legal approves | All active Linkages users | `action_required` | `success` | Yes: begin signing |
| `agreement.signing_started` | Linkages starts signing | Owning researcher only | `status_update` | `info` | No |
| `agreement.fully_executed` | Final signed scan uploaded | Owning researcher, all active Legal, all active M&E | `status_update` | `success` | No |
| `agreement.expiry_approaching` | Stored alert date reached | All active M&E users | `deadline` | `warning` | Yes |
| `agreement.expired` | End date passed | All active M&E users | `deadline` | `critical` | Yes |
| `agreement.renewed` | M&E renews an expired agreement | All active Linkages users | `status_update` | `success` | No |
| `agreement.archived` | M&E archives an expired agreement | All active M&E except the actor | `status_update` | `info` | No |

Additional rules:

- Never notify inactive users.
- Do not notify the actor when the actor belongs to a role-wide recipient set, unless the table explicitly names the owning researcher and they happen to be the actor.
- Role broadcasts are an explicit prototype compromise. Do not invent department or individual assignment targeting.
- Every message must contain the agreement title, actor name (or `System`), what occurred, and the recipient's next step when action is required.
- Every agreement notification must link to an agreement the recipient is authorized to view.
- Do not create an in-app notification when an agreement is initially created; the researcher is already on the resulting agreement page.
- Progress-update notifications and broader M&E scheduling are outside this implementation unless separately approved.
- An already-expired agreement must not also receive `agreement.expiry_approaching` in the same run. Emit only the more urgent expired event.

## 6. Google Drive/email boundary

This work must make internal workflow notifications independent of email while preserving document access.

- Application email remains disabled with `EMAIL_ENABLED=false`.
- Initial researcher Drive access must be granted with `sendNotificationEmail=false`; the researcher receives the Doc URL inside Accord 360.
- Initial external-partner Drive access may use `sendNotificationEmail=true`; it is the only permitted email exception in this prototype.
- Initial Linkages and Legal permission grants must use `sendNotificationEmail=false` because their task appears in-app.
- Remove/stop the repeated use of `google_drive.send_notification(...)` as a workflow handoff mailer.
- Do not remove the Drive permission call itself.
- Add focused tests proving the correct `notify` flag for researcher, partner, Linkages, and Legal grants.

If the external partner is later given a portal account, this exception can be removed in a separate feature.

## 7. Required API

Preserve authentication on every route.

### Timeline

```http
GET /notifications?limit=20&cursor=<opaque>&unread_only=false&category=action_required
```

Response:

```json
{
  "items": [],
  "next_cursor": null
}
```

Requirements:

- `limit` defaults to 20 and is capped at 50.
- Cursor ordering is `(created_at DESC, id DESC)` so equal timestamps are stable.
- Filters are server-side and owner-scoped.
- Do not return a bare list from the new endpoint contract.

### Authoritative unread count

```http
GET /notifications/unread-count
```

```json
{ "count": 3 }
```

Count every unread notification, not merely the current page.

### Read operations

```http
POST /notifications/{notification_id}/read
POST /notifications/{notification_id}/unread
POST /notifications/read-all
```

- Individual operations must remain idempotent.
- `read-all` affects only the current user.
- Cross-user identifiers return 404 and do not reveal whether the record exists.
- There is no user-facing `resolve` endpoint; task resolution comes from workflow completion.

### Indexes

Add indexes supporting:

- owner timeline: `(user_id, created_at, id)`;
- owner unread queries/counts: `(user_id, is_read, created_at)`; and
- unresolved task lookup by agreement/event/recipient.

Use an Alembic migration, review it manually, and verify both PostgreSQL-compatible SQLAlchemy behavior and the SQLite test environment.

## 8. Frontend behavior

Create one shared notification provider/store mounted inside the authenticated application. `Layout` and `Notifications` must consume the same state.

The provider must:

- load the authoritative unread count;
- load the recent timeline;
- poll every 30 seconds while authenticated;
- refresh when the window regains focus;
- expose an explicit refresh function used after successful workflow mutations;
- optimistically update read state, with rollback and visible error feedback;
- stop polling after logout/unmount; and
- avoid overlapping requests.

### Bell popover

- Show the five most recent notifications, not only unread ones.
- Clearly distinguish unread and unresolved action-required items.
- Show title, agreement title, actor, relative time, and concise next action.
- Clicking the primary action may mark the item read, but must not resolve it.
- Provide “View all” and “Mark all as read.”
- The badge uses the server unread-count endpoint.
- Implement outside-click close, Escape close, focus placement/restoration, `aria-controls`, suitable popover/dialog semantics, and a live-region announcement for new unread items.
- Do not silently swallow fetch or mark-read failures.

### Full notification page

- Tabs: `Action required`, `Unread`, and `All`.
- Primary CTA: `Open task` for actionable items and `View agreement` for informational items.
- Controls: mark read/unread and mark all read.
- Resolved tasks remain available and visibly resolved.
- Use server pagination/cursors; provide a `Load more` control.
- Remove frontend-invented fields such as hard-coded sender, fabricated agreement reference, and message-as-required-action.
- Use the backend's category, severity, actor, agreement title, action URL, and timestamps directly.
- Repair the existing JSX/CSS class mismatch rather than adding a second competing notification style system.
- Preserve mobile usability and keyboard access.

## 9. Mock-mode parity

Mock mode is part of the prototype and must demonstrate the same behavior as the backend.

- Implement the new API response envelope, unread count, read, unread, read-all, filters, and cursor/limit behavior.
- Workflow transitions must generate the same event types, recipients, content categories, action state, and resolution behavior as the real backend.
- Seed useful notifications for all four roles, not only Linkages.
- Do not keep a separate informal event matrix in mock code. Mirror the frozen policy exactly and cover parity with tests.
- Persist mock read/resolution state using the existing mock persistence approach.

## 10. Required tests and gates

### Backend tests

- Exact recipients and exactly one row per recipient for every event in Section 5.
- No inactive users and no unintended actor self-notification.
- Owning-researcher targeting never notifies unrelated researchers.
- Duplicate/retried event creation does not create a second recipient row.
- Reading/unreading is owner-only and idempotent.
- Cross-user mutation returns 404.
- Read-all affects only the current user.
- Unread count includes records outside the first page.
- Pagination returns more than 50 records without loss or duplication.
- Equal timestamps have stable ID ordering.
- Workflow completion resolves the corresponding shared-team task notifications.
- Transaction rollback does not leave a notification behind.
- Expired records do not also receive approaching-expiry notifications.
- Google Drive notification flags follow Section 6.

Run from `backend/`:

```bash
python -m pytest -q
```

### Frontend/mock tests

- Each important mock workflow action creates the correct recipient notification.
- Badge count updates after polling/refetch and after read/unread operations.
- Page and bell never disagree because they use the same store.
- Mark-all-read works.
- Action-required and resolved filtering works.
- Failed requests produce visible feedback and rollback optimistic state.
- Existing role-based mock workflow remains valid.

Run from `frontend/`:

```bash
npm run check
```

Both gates must pass before handoff. Do not weaken or delete existing tests to make the gates pass.

## 11. Swarm work allocation

The coordinator must enforce file ownership. Agents working concurrently must not edit the same files.

### Agent 0 — coordinator/contract owner

Owns:

- this brief;
- cross-agent decisions;
- integration ordering;
- final diff review;
- full backend and frontend verification.

The coordinator does not allow contract changes through opportunistic implementation choices.

### Agent 1 — backend data and API

Owns only:

- workflow notification model/schema/service/API files;
- the notification Alembic migration;
- backend notification API/service tests.

Deliverables:

- Section 4 model contract;
- Section 7 API;
- centralized creation/deduplication/resolution service;
- owner security and indexes.

Must finish the API contract before frontend integration is finalized.

### Agent 2 — event policy and Drive boundary

Owns only:

- agreement notification trigger call sites;
- expiry notification trigger call sites;
- Google Drive notification-flag behavior;
- event-recipient and Drive-boundary tests.

Must call Agent 1's centralized notification service. Must not create a second notification abstraction.

### Agent 3 — frontend shared experience

Owns only:

- frontend notification provider/store;
- notification API wrapper/normalization;
- `Layout` notification bell;
- notification page;
- notification-specific CSS.

Must consume the frozen backend contract. Must not invent fallback business semantics in normalization.

### Agent 4 — mock parity and end-to-end verification

Owns only:

- `mockApi.js` notification behavior;
- mock smoke tests and focused frontend notification tests;
- parity validation against Section 5.

Must not change production backend behavior.

### Agent 5 — independent reviewer

Read-only until review findings are accepted. Reviews:

- authorization and information leakage;
- exact event-recipient matrix;
- duplicate/noise behavior;
- API/frontend/mock contract parity;
- accessibility;
- migration safety;
- test strength.

The reviewer must report concrete file/line evidence. It must not perform broad refactors during review.

## 12. Required execution order

1. Coordinator records the baseline `git status` and protects unrelated user changes.
2. Agent 1 implements and tests the backend contract.
3. Agent 2 integrates event triggers against that contract. Agent 3 may build against the frozen response shapes after Agent 1 publishes them.
4. Agent 4 implements mock parity after the event policy and API shapes are stable.
5. Coordinator integrates changes and resolves only genuine cross-workstream conflicts.
6. Independent reviewer audits the integrated result.
7. Findings are fixed by the owning agent, not by unrelated agents editing across boundaries.
8. Coordinator runs the complete backend and frontend gates and reviews `git diff --check`.

No agent may declare success based only on its focused tests.

## 13. Anti-drift rules

Stop and report to the coordinator if any of these occur:

- a required change needs a new role, partner portal, or staff-assignment model;
- an agent wants to add WebSockets, a queue, Redis, Celery, a new state library, or another infrastructure dependency;
- an agent needs to weaken agreement authorization or Drive permission rules;
- the migration would destroy or silently reinterpret existing notification data;
- backend, frontend, and mock contracts differ;
- a recipient decision is not explicitly covered by Section 5;
- unrelated dirty-worktree changes overlap an owned file;
- a test failure exposes a product decision not settled here.

Agents must not:

- rewrite unrelated modules;
- rename roles or workflow statuses;
- alter Google Docs content handling;
- re-enable email;
- create marketing/broadcast functionality;
- add speculative notification events;
- hide test failures with broader mocks;
- replace owner checks with frontend filtering;
- commit credentials, `.env`, service-account keys, databases, build output, or `backend/venv/`.

## 14. Definition of done

The notification prototype is complete only when:

- the bell and page share one fresh state;
- new notifications appear within 30 seconds without navigation;
- unread count is authoritative;
- tasks distinguish unread from unresolved;
- every frozen workflow event has exact, tested recipients;
- messages state actor, change, next action, and agreement;
- task links open an authorized work item;
- duplicate events do not produce duplicate recipient rows;
- role-shared tasks resolve when one authorized team member completes them;
- expired agreements do not receive conflicting deadline messages;
- internal workflow handoffs do not send email;
- the external partner retains the one necessary initial Drive invitation;
- mock mode demonstrates the same role handoffs as the backend;
- accessibility interactions work by keyboard;
- backend tests, `npm run check`, and `git diff --check` pass; and
- no unrelated behavior or files were changed.
