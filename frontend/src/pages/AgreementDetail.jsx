import { ArrowLeft, CalendarClock } from "lucide-react";
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
import { createProgressUpdate, getAgreement, transitionAgreement } from "../lib/backend.js";
import { formatDate, formatDateTime, humanize } from "../lib/format.js";

const ALL_TABS = [
  ["overview", "Overview"], ["workflow", "Workflow"], ["documents", "Documents"],
  ["corrections", "Legal review"], ["monitoring", "Progress"], ["history", "Status history"]
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

function InfoItem({ label, children }) {
  return <div className="info-item"><span>{label}</span><strong>{children || "—"}</strong></div>;
}

export default function AgreementDetail({ defaultTab }) {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [fieldsConfirmed, setFieldsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progressForm, setProgressForm] = useState({ quarter: "", notes: "" });
  const navigate = useNavigate();
  const tabs = tabsForRole(user.role);
  const requestedTab = searchParams.get("tab") || defaultTab || roleDefaultTab(user.role, record?.status);
  const tab = tabs.some(([key]) => key === requestedTab) ? requestedTab : tabs[0][0];

  const load = useCallback(() => {
    setError("");
    getAgreement(id).then(setRecord).catch((requestError) => setError(requestError.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const availableActions = useMemo(
    () => (record?.available_actions || []).map((key) => ({ key, label: humanize(key), variant: key === "archive" ? "danger" : "primary" })),
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

  if (error && !record) return <><PageHeader eyebrow="Agreement workspace" title="Unable to open agreement" /><ErrorState message={error} onRetry={load} /></>;
  if (!record) return <LoadingState label="Loading agreement workspace" />;

  const canSubmitProgress = user.role === "researcher" && ["fully_executed", "expired"].includes(record.status);

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader
        eyebrow="Agreement workspace"
        title={record.title}
        description={record.partner_name}
        actions={<><button className="secondary-button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Back</button>{availableActions.map((item) => <button className={item.variant === "primary" ? "primary-button" : "danger-button"} key={item.key} onClick={() => setAction(item)}>{item.label}</button>)}</>}
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

      <nav className="tabs" aria-label="Agreement sections">{tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setSearchParams({ tab: key })}>{label}</button>)}</nav>

      {tab === "overview" && <div className="detail-grid">
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

      {tab === "workflow" && <section className="panel workflow-panel"><div className="panel-head"><div><h2>Lifecycle</h2><p>The nine-status Accord 360 workflow.</p></div></div><WorkflowTimeline agreement={record} /></section>}

      {tab === "documents" && <DocumentRepository record={record} user={user} onRecordChange={setRecord} onError={setError} onMessage={setMessage} />}

      {tab === "corrections" && <LegalReviewPanel record={record} user={user} onRecordChange={setRecord} onError={setError} onMessage={setMessage} />}

      {tab === "monitoring" && <div className="detail-grid">
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

      {tab === "history" && <section className="panel workflow-panel"><div className="panel-head"><div><h2>Status history</h2><p>Every status change this agreement has been through, and who made it.</p></div></div><div className="activity-timeline">{[...(record.workflow_events || [])].reverse().map((item) => <article key={item.id}><span className="timeline-dot" /><div><strong>{humanize(item.action)}</strong><p>{humanize(item.from_stage || "Created")} → {humanize(item.to_stage)} · {item.actor?.full_name || "System"}</p>{item.comment && <p>{item.comment}</p>}<small>{formatDateTime(item.created_at)}</small></div></article>)}</div></section>}

      <Modal
        open={Boolean(action)}
        onClose={() => { setAction(null); setFieldsConfirmed(false); }}
        title={action?.label || "Confirm action"}
        description={`${record.title} · ${humanize(record.status)}`}
        footer={<><button className="secondary-button" onClick={() => { setAction(null); setFieldsConfirmed(false); }}>Cancel</button><button className={action?.variant === "danger" ? "danger-button" : "primary-button"} disabled={submitting || (action?.key === "submit" && !fieldsConfirmed)} onClick={performAction}>{submitting ? "Processing…" : `Confirm ${action?.label || "action"}`}</button></>}
      >
        {action?.key === "submit" && <>
          <p className="helper-note">Submitting cuts off the external partner's access to the Google Doc and hands review to Linkages and Legal. Make sure the partner is done editing first.</p>
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
