import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import DocumentRepository from "../components/DocumentRepository.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LegalReviewPanel from "../components/LegalReviewPanel.jsx";
import LoadingState from "../components/LoadingState.jsx";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import WorkflowTimeline from "../components/WorkflowTimeline.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { createProgressUpdate, getAgreement, getDriveAccessStatus, reconcileDriveAccess, transitionAgreement } from "../lib/backend.js";
import { formatDate, formatDateTime, humanize } from "../lib/format.js";

const ALL_TABS = [
  ["overview", "Overview"], ["workflow", "Workflow"], ["documents", "Documents"],
  ["corrections", "Review"], ["monitoring", "Progress"], ["history", "Status history"]
];

// Researchers only need to see where their agreement stands (Workflow
// already shows that) and submit progress updates — the internal
// Linkages/Legal back-and-forth and the raw status-transition log aren't
// theirs to see.
function tabsForRole(role) {
  if (role === "researcher") return ALL_TABS.filter(([key]) => !["corrections", "history"].includes(key));
  return ALL_TABS;
}

// Each role lands on the tab that matches what they're there to do, instead
// of a generic "overview" everyone has to click past. An explicit
// `defaultTab` prop (e.g. Legal's dedicated /legal/:id route) always wins.
// Linkages is the one role that acts from two different tabs depending on
// where the agreement currently is, so their default depends on status too.
function roleDefaultTab(role, status) {
  if (role === "linkages") return status === "awaiting_signatures" ? "documents" : "corrections";
  return { legal: "corrections", me: "monitoring", researcher: "overview" }[role] || "overview";
}

const ACTION_LABELS = {
  submit: "Submit to Linkages",
  send_to_legal: "Send to Legal",
  return_to_researcher: "Return to Researcher",
  return_to_linkages: "Return to Linkages",
  resubmit: "Resubmit to Linkages",
  approve: "Approve",
  start_signing: "Start signing"
};

// From Legal approval until the signed upload, the Doc is locked: the API
// withholds its link, and "send_to_legal" means "send it back to Legal"
// (only offered when the Doc changed after approval).
const DOC_LOCKED_STATUSES = new Set(["approved_for_signing", "awaiting_signatures"]);

function actionLabel(key, status) {
  if (key === "send_to_legal" && DOC_LOCKED_STATUSES.has(status)) return "Send back to Legal";
  return ACTION_LABELS[key] || humanize(key);
}

function actionHelp(key, status) {
  if (key === "send_to_legal" && DOC_LOCKED_STATUSES.has(status)) {
    return "The Google Doc changed after Legal approved it. This cancels the approval, gives Legal edit access again and notifies them to review it before signing.";
  }
  return ACTION_HELP[key];
}

// What each action does, shown in its confirm box so nobody has to guess.
const ACTION_HELP = {
  send_to_legal: "Legal gets edit access to the Google Doc and is notified. You keep your access.",
  return_to_researcher: "The Researcher can edit the Google Doc again and is notified. Say what needs fixing in the note, or comment in the Doc.",
  return_to_linkages: "Legal's access to the Google Doc is removed and Linkages is notified.",
  approve: "Legal's access to the Google Doc is removed and Linkages is told the agreement is ready for signing.",
  resubmit: "Sends the agreement back to Linkages for review."
};

// The one thing each role is here to do at each status: open the Doc, then
// press one clear button. Shown as a focused panel; everything else is
// tucked under "More details". Buttons come from the server's
// available_actions, this only decides the wording and which ones to feature.
function focusFor(role, status) {
  if (role === "linkages" && status === "linkages_review") return { title: "Review this agreement", text: "Open the Google Doc, make your edits, then come back and choose what happens next.", actions: ["send_to_legal", "return_to_researcher"] };
  if (role === "legal" && status === "legal_review") return { title: "Legal review", text: "Open the Google Doc and comment or edit as needed, then come back and approve it or return it to Linkages.", actions: ["approve", "return_to_linkages"] };
  if (role === "researcher" && status === "returned_to_researcher") return { title: "Changes requested", text: "Open the Google Doc, address the comments, then resubmit it to Linkages.", actions: ["resubmit"] };
  if (role === "linkages" && status === "approved_for_signing") return { title: "Approved by Legal", text: "Legal has approved this agreement and the Google Doc is now locked. Start signing to download the approved signing copy.", actions: ["start_signing", "send_to_legal"] };
  return null;
}

function InfoItem({ label, children }) {
  return <div className="info-item"><span>{label}</span><strong>{children || "—"}</strong></div>;
}

export default function AgreementDetail({ defaultTab }) {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [driveAccess, setDriveAccess] = useState(null);
  const [repairingDriveAccess, setRepairingDriveAccess] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [fieldsConfirmed, setFieldsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [progressForm, setProgressForm] = useState({ quarter: "", notes: "" });
  const navigate = useNavigate();
  const tabs = tabsForRole(user.role);
  const requestedTab = searchParams.get("tab") || defaultTab || roleDefaultTab(user.role, record?.status);
  const tab = tabs.some(([key]) => key === requestedTab) ? requestedTab : tabs[0][0];

  const load = useCallback(() => {
    setError("");
    getAgreement(id).then(setRecord).catch((requestError) => setError(requestError.message));
    // Drive access status is Linkages-only (403 for everyone else).
    if (user.role === "linkages") getDriveAccessStatus(id).then(setDriveAccess).catch(() => setDriveAccess(null));
  }, [id, user.role]);

  useEffect(() => { load(); }, [load]);

  const availableActions = useMemo(
    () => (record?.available_actions || []).map((key) => ({ key, label: actionLabel(key, record.status), variant: key === "archive" ? "danger" : "primary" })),
    [record]
  );

  async function performAction() {
    if (!action) return;
    setSubmitting(true);
    setError("");
    try {
      const updated = await transitionAgreement(record.id, action.key, reason.trim() || null);
      setRecord(updated);
      setMessage(`${action.label} completed.`);
      setAction(null);
      setReason("");
      setFieldsConfirmed(false);
    } catch (requestError) {
      setError(requestError.message);
      // 409 = e.g. the Doc changed after approval; reload so the record and
      // its available actions (like "Send back to Legal") are current.
      if (requestError.status === 409) { setAction(null); load(); }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitProgressUpdate(event) {
    event.preventDefault();
    if (!progressForm.quarter.trim() || !progressForm.notes.trim()) return setError("Quarter and progress notes are required.");
    setSubmitting(true);
    try {
      await createProgressUpdate(record.id, { quarter: progressForm.quarter.trim(), notes: progressForm.notes.trim() });
      setProgressForm({ quarter: "", notes: "" });
      setMessage("Quarterly progress update submitted.");
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function repairDriveAccess() {
    setRepairingDriveAccess(true);
    setError("");
    try {
      const result = await reconcileDriveAccess(record.id);
      setDriveAccess(result);
      setMessage(result.changed ? "Google Drive access repaired." : "Google Drive access is already synchronized.");
    } catch (requestError) {
      setError(requestError.message);
      getDriveAccessStatus(record.id).then(setDriveAccess).catch(() => {});
    } finally {
      setRepairingDriveAccess(false);
    }
  }

  if (error && !record) return <><PageHeader eyebrow="Agreement workspace" title="Unable to open agreement" /><ErrorState message={error} onRetry={load} /></>;
  if (!record) return <LoadingState label="Loading agreement workspace" />;

  const docLocked = DOC_LOCKED_STATUSES.has(record.status);
  const docChanged = docLocked && record.doc_modified_after_approval === true;
  // A changed Doc can't be signed as approved: the one way forward is the
  // "Send back to Legal" button in the warning, so don't offer it twice or
  // offer a "Start signing" that would only fail.
  const sendBack = docChanged ? availableActions.find((item) => item.key === "send_to_legal") : undefined;
  const focus = focusFor(user.role, record.status);
  const focusActions = focus ? availableActions.filter((item) => focus.actions.includes(item.key) && item !== sendBack && !(docChanged && item.key === "start_signing")) : [];
  const headerActions = availableActions.filter((item) => !focusActions.includes(item) && item !== sendBack && !(docChanged && item.key === "start_signing"));
  const showTabs = !focus || showDetails;
  const activeTab = showTabs ? tab : null;
  const canSubmitProgress = user.role === "researcher" && ["fully_executed", "expired"].includes(record.status);

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader
        eyebrow="Agreement workspace"
        title={record.title}
        description={record.partner_name}
        actions={<><button className="secondary-button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Back</button>{headerActions.map((item) => <button className={item.variant === "primary" ? "primary-button" : "danger-button"} key={item.key} onClick={() => setAction(item)}>{item.label}</button>)}</>}
        meta={<div className="header-badges"><StatusBadge status={record.status} /></div>}
      />

      <section className="agreement-sticky-summary panel">
        <InfoItem label="Current status">{humanize(record.status)}</InfoItem>
        <InfoItem label="Department">{record.department}</InfoItem>
        <InfoItem label="Researcher">{record.researcher_name || "Not assigned"}</InfoItem>
        <InfoItem label="Start date">{formatDate(record.start_date)}</InfoItem>
        <InfoItem label="End date">{formatDate(record.end_date)}</InfoItem>
        {record.expiry_alert_date && <InfoItem label="Expiry alert date">{formatDate(record.expiry_alert_date)}</InfoItem>}
      </section>

      {docChanged && (
        <div className="inline-alert warning">
          <AlertTriangle size={18} />
          <div>
            <strong>The Google Doc changed after Legal approved it</strong>
            <p>It can't be signed as approved. Send it back to Legal so they can review the changes and approve it again.</p>
            {sendBack && <div className="focus-actions"><button className="primary-button" onClick={() => setAction(sendBack)}>{sendBack.label}</button></div>}
          </div>
        </div>
      )}

      {record.status === "approved_for_signing" && record.approved_at && !record.doc_modified_after_approval && (
        <div className="inline-alert success">
          <CheckCircle2 size={18} />
          <div>
            <strong>Approved by Legal{record.approved_by_name ? ` — ${record.approved_by_name}` : ""} on {formatDateTime(record.approved_at)}</strong>
            <p>{user.role === "linkages" ? "This agreement is ready for you to start signing." : "This agreement is ready for signing."}</p>
          </div>
        </div>
      )}

      {user.role === "linkages" && driveAccess && <section className="panel drive-access-panel">
        <div className="panel-head"><div><h2><ShieldCheck size={17} /> Google Drive access</h2><p>The document stays in one folder; workflow status controls direct access.</p></div>
          {driveAccess.needs_repair && <button className="secondary-button" onClick={repairDriveAccess} disabled={repairingDriveAccess}><RefreshCw size={15} className={repairingDriveAccess ? "spin" : ""} /> {repairingDriveAccess ? "Repairing…" : "Repair access"}</button>}
        </div>
        <div className="drive-access-summary"><StatusBadge tone={driveAccess.needs_repair ? "orange" : "green"}>{driveAccess.needs_repair ? "Needs repair" : "Synchronized"}</StatusBadge>{driveAccess.inherited_permissions_present && <span className="helper-note">Inherited permissions are present and cannot be changed here.</span>}</div>
      </section>}

      {focus && (
        <section className="panel focus-panel">
          <h2>{focus.title}</h2>
          <p>{focus.text}</p>
          <div className="focus-steps">
            {docLocked
              ? <p className="helper-note"><Lock size={14} /> Google Doc locked after Legal approval.</p>
              : record.template_copy_url
                ? <div><a className="primary-button focus-doc-button" href={record.template_copy_url} target="_blank" rel="noreferrer"><ExternalLink size={18} /> Open Google Doc</a></div>
                : <p className="helper-note">No Google Doc is linked to this agreement.</p>}
            {focusActions.length > 0 && <div className="focus-actions">{focusActions.map((item) => <button key={item.key} className={item.key === focusActions[0].key ? "primary-button" : "secondary-button"} onClick={() => setAction(item)}>{item.label}</button>)}</div>}
          </div>
        </section>
      )}
      {focus && <div className="focus-more"><button className="secondary-button compact-button" onClick={() => setShowDetails((value) => !value)}>{showDetails ? "Hide details" : "More details"}</button></div>}

      {showTabs && <nav className="tabs" aria-label="Agreement sections">{tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setSearchParams({ tab: key })}>{label}</button>)}</nav>}

      {activeTab === "overview" && <div className="detail-grid">
        <section className="panel detail-main-card">
          <div className="panel-head"><div><h2>Agreement overview</h2></div></div>
          <div className="info-grid">
            <InfoItem label="Partner institution">{record.partner_name}</InfoItem>
            <InfoItem label="Department">{record.department}</InfoItem>
            <InfoItem label="Researcher">{record.researcher_name || "Not assigned"}</InfoItem>
            <InfoItem label="Status">{humanize(record.status)}</InfoItem>
            <InfoItem label="Start date">{formatDate(record.start_date)}</InfoItem>
            <InfoItem label="End date">{formatDate(record.end_date)}</InfoItem>
            <InfoItem label="Days to expiry">{record.days_to_expiry ?? "—"}</InfoItem>
            <InfoItem label="Archived">{record.archived ? "Yes" : "No"}</InfoItem>
          </div>
          {record.template_copy_url && <div className="inline-alert info">
            <div><strong>Drafting document</strong><p><a href={record.template_copy_url} target="_blank" rel="noreferrer">Open in Google Docs</a> — the live copy for this drafting cycle. See the Documents tab for details.</p></div>
          </div>}
        </section>
        <aside className="panel detail-side-card">
          <div className="panel-head"><div><h2>Expiry</h2></div></div>
          {record.expiry_alert_date
            ? <div className="inline-alert info"><CalendarClock size={18} /><div><strong>{formatDate(record.expiry_alert_date)}</strong><p>M&E is notified once, on this date, six months before the end date.</p></div></div>
            : <p className="empty-state">The expiry alert date is set once this agreement is fully executed.</p>}
        </aside>
      </div>}

      {activeTab === "workflow" && <section className="panel workflow-panel"><div className="panel-head"><div><h2>Lifecycle</h2><p>The nine-status Accord 360 workflow.</p></div></div><WorkflowTimeline agreement={record} /></section>}

      {activeTab === "documents" && <DocumentRepository record={record} user={user} onRecordChange={setRecord} onError={setError} onMessage={setMessage} onStale={load} />}

      {activeTab === "corrections" && <LegalReviewPanel record={record} user={user} onRecordChange={setRecord} onError={setError} onMessage={setMessage} />}

      {activeTab === "monitoring" && <div className="detail-grid">
        <section className="panel detail-main-card">
          <div className="panel-head"><div><h2>Quarterly progress updates</h2><p>Submitted by the Researcher once this agreement is fully executed or expired.</p></div></div>
          <div className="activity-timeline">
            {(record.progress_updates || []).map((item) => <article key={item.id}><span className="timeline-dot" /><div><strong>{item.quarter}</strong><p>{item.notes}</p><small>{item.submitted_by?.full_name || "Researcher"} · {formatDateTime(item.created_at)}</small></div></article>)}
            {!(record.progress_updates || []).length && <p className="empty-state">No progress updates have been submitted yet.</p>}
          </div>
        </section>
        {canSubmitProgress && <aside className="panel detail-side-card">
          <div className="panel-head"><div><h2>Submit an update</h2></div></div>
          <form className="form-grid single-column" onSubmit={submitProgressUpdate}>
            <label className="form-field"><span>Quarter *</span><input value={progressForm.quarter} onChange={(event) => setProgressForm({ ...progressForm, quarter: event.target.value })} placeholder="2026-Q1" /></label>
            <label className="form-field"><span>Notes *</span><textarea rows="4" value={progressForm.notes} onChange={(event) => setProgressForm({ ...progressForm, notes: event.target.value })} /></label>
            <button className="primary-button" disabled={submitting} type="submit">{submitting ? "Submitting…" : "Submit progress update"}</button>
          </form>
        </aside>}
        {user.role === "researcher" && !canSubmitProgress && <aside className="panel detail-side-card">
          <div className="panel-head"><div><h2>Submit an update</h2></div></div>
          <p className="helper-note"><CalendarClock size={14} /> You can submit a quarterly progress update once this agreement is fully executed. It's currently {humanize(record.status)}.</p>
        </aside>}
      </div>}

      {activeTab === "history" && <section className="panel workflow-panel"><div className="panel-head"><div><h2>Status history</h2><p>Every status change this agreement has been through, and who made it.</p></div></div><div className="activity-timeline">{[...(record.workflow_events || [])].reverse().map((item) => <article key={item.id}><span className="timeline-dot" /><div><strong>{humanize(item.action)}</strong><p>{humanize(item.from_stage || "Created")} → {humanize(item.to_stage)} · {item.actor?.full_name || "System"}</p>{item.comment && <p>{item.comment}</p>}<small>{formatDateTime(item.created_at)}</small></div></article>)}</div></section>}

      <Modal
        open={Boolean(action)}
        onClose={() => { setAction(null); setFieldsConfirmed(false); }}
        title={action?.label || "Confirm action"}
        description={`${record.title} · ${humanize(record.status)}`}
        footer={<><button className="secondary-button" onClick={() => { setAction(null); setFieldsConfirmed(false); }}>Cancel</button><button className={action?.variant === "danger" ? "danger-button" : "primary-button"} disabled={submitting || (action?.key === "submit" && !fieldsConfirmed)} onClick={performAction}>{submitting ? "Processing…" : `Confirm ${action?.label || "action"}`}</button></>}
      >
        {actionHelp(action?.key, record.status) && <p className="helper-note">{actionHelp(action.key, record.status)}</p>}
        {action?.key === "submit" && <>
          <p className="helper-note">Submitting cuts off the external partner&apos;s access to the Google Doc and hands review to Linkages. Legal receives access later when Linkages chooses &quot;Send to Legal.&quot; Make sure the partner is done editing first.</p>
          <label className="form-field checkbox-field">
            <input type="checkbox" checked={fieldsConfirmed} onChange={(event) => setFieldsConfirmed(event.target.checked)} />
            <span>I confirm all required fields in the document have been filled in.</span>
          </label>
        </>}
        <label className="form-field"><span>Comment (optional)</span><textarea rows="4" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Add context for this decision." /></label>
      </Modal>
    </>
  );
}
