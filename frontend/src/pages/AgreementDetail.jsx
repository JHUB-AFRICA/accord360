import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, FileCheck2, FileLock2,
  FileText, History, Paperclip, RefreshCw, ShieldCheck, UploadCloud
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import DocumentRepository from "../components/DocumentRepository.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LegalReviewPanel from "../components/LegalReviewPanel.jsx";
import LoadingState from "../components/LoadingState.jsx";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import WorkflowTimeline from "../components/WorkflowTimeline.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createDeliverable,
  getAgreement,
  transitionAgreement,
  updateAgreement,
  uploadAgreementDocument
} from "../lib/backend.js";
import { formatCurrency, formatDate, formatDateTime, humanize } from "../lib/format.js";
import { calculateAgreementScore } from "../lib/normalize.js";
import { getAvailableActions, stageLabel } from "../lib/workflow.js";

const tabs = [
  ["overview", "Overview"], ["workflow", "Workflow"], ["documents", "Documents"],
  ["template", "Draft & template"], ["corrections", "Reviews & corrections"],
  ["signing", "Signing"], ["monitoring", "M&E"], ["history", "Activity history"]
];

function InfoItem({ label, children }) {
  return <div className="info-item"><span>{label}</span><strong>{children || "—"}</strong></div>;
}

function latestEvent(record, action) {
  return [...(record.workflow_events || [])].reverse().find((event) => event.action === action);
}

export default function AgreementDetail({ defaultTab = "overview" }) {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState(null);
  const emptyActionForm = { reason: "", exact_item: "", requested_change: "", effective_date: "", expiry_date: "", partner_liaison: "", initial_deliverable: "", document: null };
  const [actionForm, setActionForm] = useState(emptyActionForm);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const tab = searchParams.get("tab") || defaultTab;

  const load = useCallback(() => {
    setError("");
    getAgreement(id).then(setRecord).catch((requestError) => setError(requestError.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const availableActions = useMemo(() => getAvailableActions(record, user.role), [record, user.role]);
  const score = useMemo(() => calculateAgreementScore(record), [record]);

  function buildComment() {
    const parts = [actionForm.reason.trim()];
    if (actionForm.exact_item.trim()) parts.push(`Exact item: ${actionForm.exact_item.trim()}`);
    if (actionForm.requested_change.trim()) parts.push(`Requested change: ${actionForm.requested_change.trim()}`);
    return parts.filter(Boolean).join("\n");
  }

  async function performAction() {
    if (!action) return;
    const requiresReason = action.requiresReason || ["return_correction", "return_dvc", "reject", "close"].includes(action.key);
    if (requiresReason && !actionForm.reason.trim()) {
      setError("A detailed reason is required for this decision.");
      return;
    }
    if (["return_correction", "return_dvc"].includes(action.key) && (!actionForm.exact_item.trim() || !actionForm.requested_change.trim())) {
      setError("Identify the exact field, document or clause and state the requested change.");
      return;
    }
    if (action.key === "upload_official_signed" && !actionForm.document) {
      setError("Choose the fully signed PDF before continuing.");
      return;
    }
    if (action.key === "activate" && (!actionForm.effective_date || !actionForm.expiry_date || !actionForm.partner_liaison.trim() || (!record.deliverables.length && !actionForm.initial_deliverable.trim()))) {
      setError("Activation requires effective and expiry dates, a partner liaison and at least one deliverable target.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      let updated;
      if (action.key === "upload_official_signed") {
        await uploadAgreementDocument(record.id, {
          file: actionForm.document,
          documentType: "signed",
          version: "1.0",
          confidentiality: "internal",
          isOfficial: true
        });
        updated = await getAgreement(record.id);
      } else if (action.key === "activate") {
        updated = await updateAgreement(record.id, {
          effective_date: actionForm.effective_date,
          expiry_date: actionForm.expiry_date,
          partner_liaison: actionForm.partner_liaison.trim()
        });
        if (!updated.deliverables.length && actionForm.initial_deliverable.trim()) {
          await createDeliverable(record.id, {
            deliverable_type: actionForm.initial_deliverable.trim(),
            target_value: 1,
            actual_value: 0,
            reporting_period: "Activation baseline",
            notes: "Initial deliverable created during agreement activation.",
            evidence_document_id: null
          });
        }
        updated = await transitionAgreement(record.id, "activate", "Activation checklist completed in the Accord360 frontend.");
      } else {
        updated = await transitionAgreement(record.id, action.key, buildComment() || null);
      }
      setRecord(updated);
      setMessage(`${action.label} completed.`);
      setAction(null);
      setActionForm(emptyActionForm);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !record) return <><PageHeader eyebrow="Agreement workspace" title="Unable to open agreement" /><ErrorState message={error} onRetry={load} /></>;
  if (!record) return <LoadingState label="Loading agreement workspace" />;

  const signing = record.signing || {};
  const officialSignedDocument = record.documents.find((item) => item.type === "signed" && item.is_official);
  const activationChecks = [
    ["Legal approval complete", Boolean(latestEvent(record, "approve_legal"))],
    ["DVC RPE endorsement complete", Boolean(latestEvent(record, "approve_dvc"))],
    ["VC package submitted", Boolean(latestEvent(record, "submit_vc"))],
    ["VC signature recorded", signing.vc_signed],
    ["Partner signature complete", signing.partner_signed],
    ["Official signed PDF uploaded", Boolean(officialSignedDocument)],
    ["Effective date entered", Boolean(record.effective_date)],
    ["Expiry date entered", Boolean(record.expiry_date)],
    ["Champion assigned", Boolean(record.champion_name)],
    ["Partner liaison assigned", Boolean(record.partner_liaison_name)],
    ["M&E deliverable created", Boolean(record.deliverables.length)]
  ];

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader
        eyebrow="Agreement workspace"
        title={record.title}
        description={`${record.reference} · ${record.partner_name}`}
        actions={<><button className="secondary-button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Back</button>{availableActions.slice(0, 2).map((item) => <button className={item.variant === "primary" ? "primary-button" : item.variant === "danger" ? "danger-button" : "secondary-button"} key={item.key} onClick={() => setAction(item)}>{item.label}</button>)}</>}
        meta={<div className="header-badges"><StatusBadge tone="blue">{record.agreement_type}</StatusBadge><StatusBadge status={record.status} /><StatusBadge status={record.risk} risk /></div>}
      />

      <section className="agreement-sticky-summary panel">
        <InfoItem label="Current stage">{stageLabel(record.stage)}</InfoItem>
        <InfoItem label="Backend stage">{humanize(record.backend_stage)}</InfoItem>
        <InfoItem label="Responsible office">{record.next_office}</InfoItem>
        <InfoItem label="Champion">{record.champion_name || "Not assigned"}</InfoItem>
        <InfoItem label="Effective date">{formatDate(record.effective_date)}</InfoItem>
        <InfoItem label="Expiry date">{formatDate(record.expiry_date)}</InfoItem>
        <div className="next-action-box"><span>Required next action</span><strong>{record.current_action}</strong></div>
      </section>

      {availableActions.length > 2 && <section className="action-strip"><span>Available actions</span>{availableActions.map((item) => <button className={item.variant === "danger" ? "danger-button compact-button" : item.variant === "primary" ? "primary-button compact-button" : "secondary-button compact-button"} key={item.key} onClick={() => setAction(item)}>{item.label}</button>)}</section>}

      <nav className="tabs" aria-label="Agreement sections">{tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setSearchParams({ tab: key })}>{label}</button>)}</nav>

      {tab === "overview" && <div className="detail-grid">
        <section className="panel detail-main-card">
          <div className="panel-head"><div><h2>Agreement overview</h2><p>Fields returned by AgreementDetailOut</p></div></div>
          <div className="info-grid"><InfoItem label="Partner institution">{record.partner_name}</InfoItem><InfoItem label="Agreement type">{record.agreement_type}</InfoItem><InfoItem label="Department">{record.department}</InfoItem><InfoItem label="Owner">{record.initiator_name}</InfoItem><InfoItem label="Champion">{record.champion_name || "Not assigned"}</InfoItem><InfoItem label="Confidentiality">{humanize(record.confidentiality)}</InfoItem><InfoItem label="Date sent to VC">{formatDate(record.date_sent_vc)}</InfoItem><InfoItem label="Date sent to partner">{formatDate(record.date_sent_partner)}</InfoItem></div>
          <hr /><h3>Purpose</h3><p className="long-copy">{record.purpose}</p><h3>Strategic alignment</h3><p className="long-copy">{record.strategic_alignment}</p>
        </section>
        <aside className="panel detail-side-card"><div className="panel-head"><div><h2>Expected outcomes</h2><p>Recorded agreement outcomes</p></div></div>{record.expected_outcomes.length ? <ul className="outcome-list">{record.expected_outcomes.map((item) => <li key={item}><CheckCircle2 size={17} />{item}</li>)}</ul> : <EmptyState title="No expected outcomes recorded" text="The backend response did not include expected outcomes for this record." />}</aside>
      </div>}

      {tab === "workflow" && <section className="panel workflow-panel"><div className="panel-head"><div><h2>Canonical lifecycle</h2><p>The 17-stage presentation is mapped to the implemented backend workflow stages and events.</p></div></div><WorkflowTimeline agreement={record} /></section>}

      {tab === "documents" && <DocumentRepository record={record} user={user} onRecordChange={setRecord} onError={setError} onMessage={setMessage} />}

      {tab === "template" && <div className="detail-grid">
        <section className="panel detail-main-card"><div className="panel-head"><div><h2>Draft and template evidence</h2><p>The current backend does not expose template-library endpoints.</p></div><StatusBadge tone="yellow">Backend persistence pending</StatusBadge></div><div className="version-list">{record.documents.filter((item) => ["working_draft", "legal_approved", "partner_amendment", "supporting"].includes(item.type)).map((document) => <article key={document.id}><span>{humanize(document.type)}</span><strong>{document.name}</strong><small>Version {document.version} · {document.is_official ? "Official" : "Working"}</small></article>)}</div>{!record.documents.length && <EmptyState title="No draft documents" text="Upload a working draft or supporting document from the Documents tab." />}</section>
        <aside className="panel detail-side-card"><h2>Version controls</h2><ul className="plain-check-list"><li><ShieldCheck /> File versions are stored by the backend.</li><li><FileLock2 /> Official status distinguishes approved documents.</li><li><History /> Workflow events provide the audit history.</li><li><Paperclip /> Downloads require agreement and document permission.</li></ul></aside>
      </div>}

      {tab === "corrections" && <LegalReviewPanel record={record} user={user} onRecordChange={setRecord} onError={setError} onMessage={setMessage} />}

      {tab === "signing" && <div className="detail-grid">
        <section className="panel detail-main-card"><div className="panel-head"><div><h2>Signing and execution</h2><p>Signing milestones are derived from workflow status and events.</p></div><StatusBadge status={record.status} /></div><div className="signing-tracks"><article className={signing.vc_signed ? "complete" : ""}><span className="signing-icon"><ShieldCheck /></span><div><h3>JKUAT signatory</h3><p>Vice Chancellor</p><strong>{signing.vc_signed ? `Recorded ${formatDate(signing.vc_signed_at)}` : "Awaiting signature"}</strong></div></article><article className={signing.partner_signed ? "complete" : ""}><span className="signing-icon"><FileCheck2 /></span><div><h3>Partner signatory</h3><p>Authorized partner officer</p><strong>{signing.partner_signed ? `Recorded ${formatDate(signing.partner_signed_at)}` : "Awaiting signature"}</strong></div></article><article className={officialSignedDocument ? "complete" : ""}><span className="signing-icon"><UploadCloud /></span><div><h3>Executed document</h3><p>Official signed PDF</p><strong>{officialSignedDocument ? officialSignedDocument.name : "Not uploaded"}</strong></div></article></div></section>
        <aside className="panel detail-side-card"><h2>Activation checklist</h2><div className="activation-list">{activationChecks.map(([label, complete]) => <span className={complete ? "complete" : ""} key={label}>{complete ? <CheckCircle2 /> : <span className="empty-check" />}{label}</span>)}</div><p className="helper-note">The backend validates this checklist again before activation.</p></aside>
      </div>}

      {tab === "monitoring" && <div className="detail-grid">
        <section className="panel detail-main-card"><div className="panel-head"><div><h2>Monitoring and evaluation</h2><p>Deliverables and value records returned with the agreement</p></div><Link to={`/monitoring/reports/${record.id}`} className="text-link">Open M&E update</Link></div>{record.deliverables.length ? <div className="document-list">{record.deliverables.map((item) => <article className="document-row" key={item.id}><RefreshCw /><div><strong>{item.deliverable_type}</strong><span>{item.actual_value} actual / {item.target_value} target · {item.reporting_period || "No period"}</span><small>{item.notes || "No notes"}</small></div><StatusBadge tone={Number(item.actual_value) >= Number(item.target_value) ? "green" : "orange"}>{Number(item.actual_value) >= Number(item.target_value) ? "Target met" : "In progress"}</StatusBadge></article>)}</div> : <EmptyState title="No deliverables recorded" text="Create the first target from the M&E update screen." />}</section>
        <aside className="panel detail-side-card"><h2>Current calculated score</h2><div className="score-preview"><strong>{score.overall}</strong><span>Client-calculated from backend deliverables</span><StatusBadge tone={score.overall >= 80 ? "green" : score.overall >= 60 ? "blue" : "orange"}>{score.category}</StatusBadge></div><div className="metric-preview">{record.values.map((item) => <article key={item.id}><span>{item.value_type}</span><strong>{formatCurrency(item.amount, item.currency)}</strong></article>)}</div><p className="helper-note">Score persistence requires a future backend scorecard endpoint. No unsupported endpoint is called.</p></aside>
      </div>}

      {tab === "history" && <section className="panel workflow-panel"><div className="panel-head"><div><h2>Agreement activity history</h2><p>Read-only workflow events from AgreementDetailOut.</p></div></div><div className="activity-timeline">{[...(record.workflow_events || [])].reverse().map((item) => <article key={item.id}><span className="timeline-dot" /><div><strong>{humanize(item.action)}</strong><p>{humanize(item.from_stage || "Created")} → {humanize(item.to_stage)} · {item.actor?.full_name || "System"}</p>{item.comment && <p>{item.comment}</p>}<small>{formatDateTime(item.created_at)}</small></div></article>)}</div></section>}

      <Modal open={Boolean(action)} onClose={() => setAction(null)} title={action?.label || "Confirm action"} description={`Agreement ${record.reference} · ${humanize(record.backend_stage)}`} footer={<><button className="secondary-button" onClick={() => setAction(null)}>Cancel</button><button className={action?.variant === "danger" ? "danger-button" : "primary-button"} disabled={submitting} onClick={performAction}>{submitting ? "Processing…" : `Confirm ${action?.label || "action"}`}</button></>}>
        <div className="decision-summary"><AlertTriangle size={20} /><p>This action uses the implemented agreement transition, update, document or M&E endpoints and creates the backend audit event where supported.</p></div>
        {(action?.requiresReason || ["return_correction", "return_dvc", "reject", "close"].includes(action?.key)) && <div className="form-grid single-column"><label className="form-field"><span>Decision reason *</span><textarea rows="4" value={actionForm.reason} onChange={(event) => setActionForm({ ...actionForm, reason: event.target.value })} placeholder="Provide a clear, specific and auditable reason." /></label>{["return_correction", "return_dvc"].includes(action?.key) && <><label className="form-field"><span>Exact field, document or clause *</span><input value={actionForm.exact_item} onChange={(event) => setActionForm({ ...actionForm, exact_item: event.target.value })} /></label><label className="form-field"><span>Requested change *</span><textarea rows="3" value={actionForm.requested_change} onChange={(event) => setActionForm({ ...actionForm, requested_change: event.target.value })} /></label></>}</div>}
        {action?.key === "upload_official_signed" && <label className="upload-zone compact-upload"><UploadCloud /><strong>{actionForm.document?.name || "Choose fully signed PDF"}</strong><span>Uploaded as document_type=signed and is_official=true.</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => setActionForm({ ...actionForm, document: event.target.files?.[0] || null })} /></label>}
        {action?.key === "activate" && <div className="form-grid"><label className="form-field"><span>Effective date *</span><input type="date" value={actionForm.effective_date} onChange={(event) => setActionForm({ ...actionForm, effective_date: event.target.value })} /></label><label className="form-field"><span>Expiry date *</span><input type="date" value={actionForm.expiry_date} onChange={(event) => setActionForm({ ...actionForm, expiry_date: event.target.value })} /></label><label className="form-field"><span>Partner liaison *</span><input value={actionForm.partner_liaison} onChange={(event) => setActionForm({ ...actionForm, partner_liaison: event.target.value })} /></label>{!record.deliverables.length && <label className="form-field"><span>Initial deliverable *</span><input value={actionForm.initial_deliverable} onChange={(event) => setActionForm({ ...actionForm, initial_deliverable: event.target.value })} /></label>}</div>}
      </Modal>
    </>
  );
}
