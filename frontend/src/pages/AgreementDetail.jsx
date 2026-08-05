import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, FileCheck2, FileLock2,
  FileText, History, Paperclip, RefreshCw, ShieldCheck, UploadCloud
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import DocumentRepository from "../components/DocumentRepository";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LegalReviewPanel from "../components/LegalReviewPanel";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import WorkflowTimeline from "../components/WorkflowTimeline";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatCurrency, formatDate, formatDateTime } from "../lib/format";
import { getAvailableActions, stageLabel } from "../lib/workflow";

const tabs = [
  ["overview", "Overview"], ["workflow", "Workflow"], ["documents", "Documents"],
  ["template", "Draft & template"], ["corrections", "Reviews & corrections"],
  ["signing", "Signing"], ["monitoring", "M&E"], ["history", "Activity history"]
];

function InfoItem({ label, children }) {
  return <div className="info-item"><span>{label}</span><strong>{children || "—"}</strong></div>;
}

export default function AgreementDetail({ defaultTab = "overview" }) {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState(null);
  const emptyActionForm = { reason: "", category: "General correction", exact_item: "", requested_change: "", due_date: "", requested_from_role: "researcher", effective_date: "", expiry_date: "", partner_liaison_name: "", initial_deliverable: "", date: "", document: null };
  const [actionForm, setActionForm] = useState(emptyActionForm);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const tab = searchParams.get("tab") || defaultTab;

  const load = useCallback(() => {
    setError("");
    api(`/agreements/${id}`).then(setRecord).catch((requestError) => setError(requestError.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const availableActions = useMemo(() => getAvailableActions(record, user.role), [record, user.role]);

  async function performAction() {
    if (!action) return;
    if (action.requiresReason && !actionForm.reason.trim()) {
      setError("A detailed reason is required for this decision.");
      return;
    }
    if (["return_correction", "request_amendment"].includes(action.key) && (!actionForm.exact_item.trim() || !actionForm.requested_change.trim())) {
      setError("Identify the exact field, document or clause and state the requested change.");
      return;
    }
    if (action.key === "upload_signed" && !actionForm.document) {
      setError("Choose the fully signed PDF before continuing.");
      return;
    }
    if (action.key === "activate" && (!actionForm.effective_date || !actionForm.expiry_date || !actionForm.partner_liaison_name.trim() || !actionForm.initial_deliverable.trim())) {
      setError("Enter the effective date, expiry date, partner liaison and at least one initial deliverable before activation.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const updated = await api(`/agreements/${record.id}/actions/${action.key}`, { method: "POST", body: JSON.stringify(actionForm) });
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

  const blockingComments = (record.legal_comments || []).filter((item) => item.blocking && item.status !== "resolved").length;
  const signing = record.signing || {};
  const activationChecks = [
    ["Legal approval complete", record.template?.locked],
    ["DVC RPE endorsement complete", record.lifecycle_history?.some((item) => item.stage === "dvc_endorsement" && item.status === "completed")],
    ["VC package complete", record.lifecycle_history?.some((item) => item.stage === "vc_submission" && item.status === "completed")],
    ["JKUAT signature complete", signing.vc_signed],
    ["Partner signature complete", signing.partner_signed],
    ["Fully signed PDF uploaded", signing.fully_signed_uploaded || record.documents?.some((item) => item.status === "final_signed")],
    ["Effective date entered", Boolean(record.effective_date)],
    ["Expiry date entered", Boolean(record.expiry_date)],
    ["Champion assigned", Boolean(record.champion_id)],
    ["Partner liaison assigned", Boolean(record.partner_liaison_name)],
    ["Initial deliverable created", Boolean(record.initial_deliverables?.length)]
  ];

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader
        eyebrow="Agreement workspace"
        title={record.title}
        description={`${record.reference} · ${record.partner_name}`}
        actions={<><button className="secondary-button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Back</button>{availableActions.slice(0, 2).map((item) => <button className={`${item.variant === "primary" ? "primary-button" : item.variant === "danger" ? "danger-button" : "secondary-button"}`} key={item.key} onClick={() => setAction(item)}>{item.label}</button>)}</>}
        meta={<div className="header-badges"><StatusBadge tone="blue">{record.agreement_type}</StatusBadge><StatusBadge status={record.status} /><StatusBadge status={record.risk} risk /></div>}
      />

      <section className="agreement-sticky-summary panel">
        <InfoItem label="Current stage">{stageLabel(record.stage)}</InfoItem>
        <InfoItem label="Responsible office">{record.next_office}</InfoItem>
        <InfoItem label="Days in stage">{record.days_in_stage}</InfoItem>
        <InfoItem label="Champion">{record.champion_name || "Not assigned"}</InfoItem>
        <InfoItem label="Effective date">{formatDate(record.effective_date)}</InfoItem>
        <InfoItem label="Expiry date">{formatDate(record.expiry_date)}</InfoItem>
        <div className="next-action-box"><span>Required next action</span><strong>{record.current_action}</strong></div>
      </section>

      {availableActions.length > 2 && <section className="action-strip"><span>Available actions</span>{availableActions.map((item) => <button className={item.variant === "danger" ? "danger-button compact-button" : item.variant === "primary" ? "primary-button compact-button" : "secondary-button compact-button"} key={item.key} onClick={() => setAction(item)}>{item.label}</button>)}</section>}

      <nav className="tabs" aria-label="Agreement sections">{tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setSearchParams({ tab: key })}>{label}</button>)}</nav>

      {tab === "overview" && <div className="detail-grid">
        <section className="panel detail-main-card"><div className="panel-head"><div><h2>Agreement overview</h2><p>Core institutional and collaboration information</p></div></div><div className="info-grid"><InfoItem label="Partner institution">{record.partner_name}</InfoItem><InfoItem label="Agreement type">{record.agreement_type}</InfoItem><InfoItem label="Faculty">{record.faculty}</InfoItem><InfoItem label="Department">{record.department}</InfoItem><InfoItem label="Initiator">{record.initiator_name}</InfoItem><InfoItem label="Champion">{record.champion_name || "Not assigned"}</InfoItem><InfoItem label="Intended start">{formatDate(record.intended_start_date)}</InfoItem><InfoItem label="Proposed duration">{record.proposed_duration_months} months</InfoItem></div><hr /><h3>Purpose</h3><p className="long-copy">{record.purpose}</p><h3>Collaboration area</h3><p className="long-copy">{record.collaboration_area}</p><h3>Strategic alignment</h3><p className="long-copy">{record.strategic_alignment}</p></section>
        <aside className="panel detail-side-card"><div className="panel-head"><div><h2>Expected outcomes</h2><p>Measurable intended results</p></div></div><ul className="outcome-list">{(record.expected_outcomes || []).map((item) => <li key={item}><CheckCircle2 size={17} />{item}</li>)}</ul><hr /><h3>Governance readiness</h3><div className="readiness-list"><span className={record.champion_id ? "done" : ""}><CheckCircle2 /> Champion assigned</span><span className={record.template ? "done" : ""}><CheckCircle2 /> Template selected</span><span className={record.documents?.length ? "done" : ""}><CheckCircle2 /> Documents uploaded</span><span className={!blockingComments ? "done" : ""}><CheckCircle2 /> No blocking Legal comments</span></div></aside>
      </div>}

      {tab === "workflow" && <section className="panel workflow-panel"><div className="panel-head"><div><h2>Canonical agreement lifecycle</h2><p>Every stage shows its responsible office and completion state.</p></div><StatusBadge tone="blue">Stage {record.lifecycle_history?.filter((item) => item.status === "completed").length + 1} of 17</StatusBadge></div><WorkflowTimeline agreement={record} /></section>}

      {tab === "documents" && <DocumentRepository record={record} user={user} onRecordChange={setRecord} onError={setError} onMessage={setMessage} />}

      {tab === "template" && <div className="detail-grid">
        <section className="panel detail-main-card"><div className="panel-head"><div><h2>Selected standard template</h2><p>The legally approved base document for this agreement type</p></div>{record.template?.locked && <StatusBadge tone="green">Locked</StatusBadge>}</div>{record.template ? <><div className="template-summary"><FileText size={28} /><div><strong>{record.template.title || record.template.name}</strong><span>Version {record.template.version}</span></div></div><div className="compliance-card"><div><strong>Template alignment</strong><span>Working draft alignment against the selected standard template</span></div><div className="compliance-score">{record.template.compliance || 100}%</div></div><div className="version-list"><article><span>Standard</span><strong>{record.template.title || record.template.name} v{record.template.version}</strong><small>Read-only base template</small></article>{record.documents?.filter((item) => ["Working draft", "Legal-approved draft"].includes(item.type)).map((document) => <article key={document.id}><span>{document.type}</span><strong>{document.name}</strong><small>Version {document.version} · {document.status}</small></article>)}</div></> : <EmptyState title="No template selected" text="An approved template must be selected before drafting can proceed." />}</section>
        <aside className="panel detail-side-card"><h2>Version controls</h2><ul className="plain-check-list"><li><ShieldCheck /> Version history is preserved for audit and comparison.</li><li><FileLock2 /> Legal-approved versions are locked and read-only.</li><li><History /> Audit events record every replacement and approval.</li><li><Paperclip /> Partner amendments remain linked to their source.</li></ul></aside>
      </div>}

      {tab === "corrections" && <LegalReviewPanel record={record} user={user} onRecordChange={setRecord} onError={setError} onMessage={setMessage} />}

      {tab === "signing" && <div className="detail-grid">
        <section className="panel detail-main-card"><div className="panel-head"><div><h2>Signing and execution</h2><p>Track the approved version through both institutional signatures.</p></div><StatusBadge status={record.status} /></div><div className="signing-tracks"><article className={signing.vc_signed ? "complete" : ""}><span className="signing-icon"><ShieldCheck /></span><div><h3>JKUAT signatory</h3><p>Vice Chancellor</p><strong>{signing.vc_signed ? `Signed ${formatDate(signing.vc_signed_at)}` : "Awaiting signature"}</strong></div></article><article className={signing.partner_signed ? "complete" : ""}><span className="signing-icon"><FileCheck2 /></span><div><h3>Partner signatory</h3><p>Authorized partner officer</p><strong>{signing.partner_signed ? `Signed ${formatDate(signing.partner_signed_at)}` : "Awaiting signature"}</strong></div></article><article className={signing.fully_signed_uploaded ? "complete" : ""}><span className="signing-icon"><UploadCloud /></span><div><h3>Executed document</h3><p>Final signed PDF</p><strong>{signing.fully_signed_uploaded ? "Uploaded" : "Not uploaded"}</strong></div></article></div></section>
        <aside className="panel detail-side-card"><h2>Activation checklist</h2><div className="activation-list">{activationChecks.map(([label, complete]) => <span className={complete ? "complete" : ""} key={label}>{complete ? <CheckCircle2 /> : <span className="empty-check" />}{label}</span>)}</div><p className="helper-note">Activation remains disabled until all mandatory items are complete and verified.</p></aside>
      </div>}

      {tab === "monitoring" && <div className="detail-grid">
        <section className="panel detail-main-card"><div className="panel-head"><div><h2>Monitoring and evaluation</h2><p>Six-month reporting, deliverables and evidence</p></div><Link to="/monitoring" className="text-link">Open M&E workspace</Link></div>{record.status === "active" ? <div className="monitoring-overview"><div className="score-preview"><strong>82</strong><span>Current demonstration score</span><StatusBadge tone="green">Strong partnership</StatusBadge></div><div className="metric-preview"><article><span>Reporting cycle</span><strong>Every six months</strong></article><article><span>Financial/resource value</span><strong>{formatCurrency(2500000)}</strong></article><article><span>Next report</span><strong>30 July 2026</strong></article></div></div> : <EmptyState title="M&E starts after activation" text="Deliverables and reporting cycles are created when the activation checklist is completed." />}</section>
        <aside className="panel detail-side-card"><h2>Performance controls</h2><ul className="plain-check-list"><li><CalendarDays /> Recurring six-month reports</li><li><Paperclip /> Evidence linked to deliverables</li><li><RefreshCw /> Target-versus-actual updates</li><li><AlertTriangle /> Dormancy and expiry alerts</li></ul></aside>
      </div>}

      {tab === "history" && <section className="panel workflow-panel"><div className="panel-head"><div><h2>Agreement activity history</h2><p>Lifecycle events displayed here are read-only.</p></div></div><div className="activity-timeline">{[...(record.lifecycle_history || [])].reverse().map((item, index) => <article key={`${item.stage}-${index}`}><span className="timeline-dot" /><div><strong>{stageLabel(item.stage)}</strong><p>{item.status === "completed" ? "Stage completed" : "Stage started"} · {item.responsible}</p><small>{formatDate(item.completed_at || item.started_at)}</small></div></article>)}</div></section>}

      <Modal open={Boolean(action)} onClose={() => setAction(null)} title={action?.label || "Confirm action"} description={`Agreement ${record.reference} · ${stageLabel(record.stage)}`} footer={<><button className="secondary-button" onClick={() => setAction(null)}>Cancel</button><button className={action?.variant === "danger" ? "danger-button" : "primary-button"} disabled={submitting} onClick={performAction}>{submitting ? "Processing…" : `Confirm ${action?.label || "action"}`}</button></>}>
        <div className="decision-summary"><AlertTriangle size={20} /><p>This action changes the agreement lifecycle and creates a permanent audit event. Accord360 will verify your authority, current stage and record scope.</p></div>
        {(action?.requiresReason || ["return_correction", "request_amendment", "reject", "close", "archive"].includes(action?.key)) && <div className="form-grid single-column"><label className="form-field"><span>Decision reason *</span><textarea rows="4" value={actionForm.reason} onChange={(event) => setActionForm({ ...actionForm, reason: event.target.value })} placeholder="Provide a clear, specific and auditable reason." /></label>{["return_correction", "request_amendment"].includes(action?.key) && <><label className="form-field"><span>Correction category</span><select value={actionForm.category} onChange={(event) => setActionForm({ ...actionForm, category: event.target.value })}><option>Missing Document</option><option>Clause Amendment</option><option>Strategic Alignment</option><option>Expected Outcomes</option><option>Template Compliance</option><option>General correction</option></select></label><label className="form-field"><span>Return request to</span><select value={actionForm.requested_from_role} onChange={(event) => setActionForm({ ...actionForm, requested_from_role: event.target.value })}><option value="researcher">Researcher / Initiator</option><option value="partner">External Partner</option><option value="linkages">Linkages Officer</option><option value="approver">Faculty Approver</option><option value="me">Champion / M&E</option></select></label><label className="form-field"><span>Exact field, document or clause *</span><input value={actionForm.exact_item} onChange={(event) => setActionForm({ ...actionForm, exact_item: event.target.value })} /></label><label className="form-field"><span>Requested change *</span><textarea rows="3" value={actionForm.requested_change} onChange={(event) => setActionForm({ ...actionForm, requested_change: event.target.value })} /></label><label className="form-field"><span>Due date</span><input type="date" value={actionForm.due_date} onChange={(event) => setActionForm({ ...actionForm, due_date: event.target.value })} /></label></>}</div>}
        {["record_vc_signature", "record_partner_signature"].includes(action?.key) && <label className="form-field"><span>Signature date</span><input type="date" value={actionForm.date} onChange={(event) => setActionForm({ ...actionForm, date: event.target.value })} /></label>}
        {action?.key === "upload_signed" && <label className="upload-zone compact-upload"><UploadCloud /><strong>{actionForm.document?.name || "Choose fully signed PDF"}</strong><span>PDF only. The executed agreement will be validated, secured and versioned.</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; setActionForm({ ...actionForm, document: file ? { name: file.name, size: file.size, mime_type: file.type } : null }); }} /></label>}
        {action?.key === "activate" && <div className="form-grid"><label className="form-field"><span>Effective date *</span><input type="date" value={actionForm.effective_date} onChange={(event) => setActionForm({ ...actionForm, effective_date: event.target.value })} /></label><label className="form-field"><span>Expiry date *</span><input type="date" value={actionForm.expiry_date} onChange={(event) => setActionForm({ ...actionForm, expiry_date: event.target.value })} /></label><label className="form-field"><span>Partner liaison *</span><input value={actionForm.partner_liaison_name} onChange={(event) => setActionForm({ ...actionForm, partner_liaison_name: event.target.value })} placeholder="Authorized partner contact" /></label><label className="form-field"><span>Initial deliverable *</span><input value={actionForm.initial_deliverable} onChange={(event) => setActionForm({ ...actionForm, initial_deliverable: event.target.value })} placeholder="First measurable output or obligation" /></label></div>}
      </Modal>
    </>
  );
}
