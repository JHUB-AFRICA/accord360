import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Download, FileText, History, Paperclip, Plus, Save, Upload } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api, downloadFile } from "../lib/api";

const actions = [
  { key: "submit", label: "Submit request", stages: ["initiation"], statuses: ["draft", "correction_required"], roles: ["researcher", "linkages", "director_linkages"] },
  { key: "approve_department", label: "Approve department gate", stages: ["department_approval"], statuses: ["pending_department"], roles: ["approver"] },
  { key: "return_correction", label: "Return for correction", stages: ["department_approval", "linkages_review", "legal_review"], roles: ["approver", "linkages", "director_linkages", "legal"] },
  { key: "approve_linkages", label: "Approve Linkages review", stages: ["linkages_review"], statuses: ["pending_linkages"], roles: ["linkages", "director_linkages"] },
  { key: "send_legal", label: "Send to Legal Office", stages: ["linkages_review"], statuses: ["linkages_approved"], roles: ["linkages", "director_linkages"] },
  { key: "approve_legal", label: "Approve legal version", stages: ["legal_review"], statuses: ["in_legal_review", "pending_legal", "legal_stalled", "dvc_returned"], roles: ["legal"] },
  { key: "approve_dvc", label: "Endorse for VC submission", stages: ["dvc_approval"], statuses: ["legal_approved"], roles: ["dvc"] },
  { key: "return_dvc", label: "Return with DVC remarks", stages: ["dvc_approval"], statuses: ["legal_approved"], roles: ["dvc"] },
  { key: "submit_vc", label: "Submit package to VC Office", stages: ["vc_submission"], statuses: ["dvc_approved"], roles: ["linkages", "director_linkages"] },
  { key: "record_vc_signature", label: "Record VC signature", stages: ["validation_signing"], statuses: ["awaiting_vc_signature"], roles: ["vc_office"] },
  { key: "mark_signed", label: "Mark fully signed", stages: ["validation_signing"], statuses: ["awaiting_vc_signature", "awaiting_partner_signature"], roles: ["vc_office", "linkages", "director_linkages"] },
  { key: "activate", label: "Activate agreement", stages: ["validation_signing"], statuses: ["fully_signed"], roles: ["linkages", "director_linkages"] },
  { key: "renew", label: "Start renewal", stages: ["active"], roles: ["linkages", "director_linkages"] },
  { key: "close", label: "Close agreement", stages: ["active", "renewal_closure"], roles: ["linkages", "director_linkages"] },
  { key: "archive", label: "Archive", stages: ["renewal_closure"], statuses: ["closed"], roles: ["linkages", "director_linkages"] },
  { key: "reject", label: "Reject", stages: ["department_approval", "linkages_review", "legal_review", "dvc_approval", "vc_submission", "validation_signing"], roles: ["approver", "linkages", "director_linkages", "legal", "dvc"] }
];

export default function AgreementDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [tab, setTab] = useState("overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [upload, setUpload] = useState({ file: null, document_type: "supporting", version: "1.0", confidentiality: "internal", is_official: false });
  const [deliverable, setDeliverable] = useState({ deliverable_type: "Internships", target_value: 0, actual_value: 0, reporting_period: "2026", notes: "" });
  const [valueRecord, setValueRecord] = useState({ value_type: "Research grant", amount: 0, currency: "KES", reporting_period: "2026", source: "" });
  const [edit, setEdit] = useState({});

  async function load() {
    const data = await api(`/agreements/${id}`);
    setItem(data);
    setEdit({
      internal_champion: data.internal_champion || "",
      partner_liaison: data.partner_liaison || "",
      effective_date: data.effective_date || "",
      expiry_date: data.expiry_date || "",
      date_sent_vc: data.date_sent_vc || "",
      date_sent_partner: data.date_sent_partner || "",
      signing_date: data.signing_date || "",
      next_action: data.next_action || ""
    });
  }
  useEffect(() => { load().catch((err) => setError(err.message)); }, [id]);

  const progress = useMemo(() => {
    const stages = ["initiation", "department_approval", "linkages_review", "legal_review", "dvc_approval", "vc_submission", "validation_signing", "active", "renewal_closure", "archived"];
    return Math.max(0, stages.indexOf(item?.stage));
  }, [item]);

  const canManageLifecycleData = item && ["linkages", "director_linkages"].includes(user.role);
  const canEditSigningData = item && user.role === "vc_office" && ["vc_submission", "validation_signing"].includes(item.stage);
  const canEditOverview = canManageLifecycleData || canEditSigningData;
  const meStages = ["validation_signing", "active", "renewal_closure"];
  const canUpload = item && item.stage !== "archived" && (
    ["linkages", "director_linkages", "legal", "vc_office"].includes(user.role) ||
    (user.role === "me" && meStages.includes(item.stage)) ||
    (user.role === "researcher" && ["initiation", ...meStages].includes(item.stage))
  );
  const canManageME = item && meStages.includes(item.stage) && ["linkages", "director_linkages", "me", "researcher"].includes(user.role);
  const canManageValue = item && ["active", "renewal_closure"].includes(item.stage) && ["linkages", "director_linkages", "me"].includes(user.role);

  async function transition(action) {
    const comment = window.prompt("Optional workflow comment:", "") ?? "";
    try {
      await api(`/agreements/${id}/transition`, { method: "POST", body: JSON.stringify({ action, comment }) });
      setMessage("Workflow updated successfully.");
      await load();
    } catch (err) { setError(err.message); }
  }

  async function saveDetails(event) {
    event.preventDefault();
    const allowedFields = canManageLifecycleData
      ? ["internal_champion", "partner_liaison", "effective_date", "expiry_date", "date_sent_vc", "date_sent_partner", "signing_date", "next_action"]
      : ["date_sent_vc", "date_sent_partner", "signing_date", "next_action"];
    const payload = Object.fromEntries(allowedFields.map((key) => [key, edit[key] === "" ? null : edit[key]]));
    try {
      await api(`/agreements/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setMessage("Agreement details saved.");
      await load();
    } catch (err) { setError(err.message); }
  }

  async function uploadFile(event) {
    event.preventDefault();
    if (!upload.file) return;
    const data = new FormData();
    data.append("file", upload.file);
    data.append("document_type", upload.document_type);
    data.append("version", upload.version);
    data.append("confidentiality", upload.confidentiality);
    data.append("is_official", upload.is_official);
    try {
      await api(`/agreements/${id}/documents`, { method: "POST", body: data });
      setMessage("Document uploaded.");
      setUpload({ file: null, document_type: "supporting", version: "1.0", confidentiality: "internal", is_official: false });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function addDeliverable(event) {
    event.preventDefault();
    try {
      await api(`/agreements/${id}/deliverables`, { method: "POST", body: JSON.stringify(deliverable) });
      setMessage("Deliverable added.");
      await load();
    } catch (err) { setError(err.message); }
  }

  async function addValue(event) {
    event.preventDefault();
    try {
      await api(`/agreements/${id}/values`, { method: "POST", body: JSON.stringify(valueRecord) });
      setMessage("Value record added.");
      await load();
    } catch (err) { setError(err.message); }
  }

  if (!item) return <div className="panel page-loading">Loading agreement...</div>;

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader
        eyebrow={item.reference_number}
        title={item.title}
        description={`${item.agreement_type} with ${item.partner.name}`}
        actions={<><Link to="/agreements" className="secondary-button"><ArrowLeft size={17} /> Back</Link><StatusBadge color={item.status_color}>{item.status.replaceAll("_", " ")}</StatusBadge></>}
      />

      <div className="progress-card panel">
        {["Initiation", "Department", "Linkages", "Legal", "DVC RPE", "VC package", "Signing", "Active", "Renewal", "Archive"].map((label, index) => (
          <div className={`progress-step ${index <= progress ? "done" : ""}`} key={label}>
            <div>{index < progress ? <CheckCircle2 size={17} /> : index + 1}</div><span>{label}</span>
          </div>
        ))}
      </div>

      <div className="detail-top-grid">
        <div className="panel detail-summary span-2">
          <div className="summary-title"><div><h3>Request summary</h3><p>{item.purpose}</p></div><span className="type-pill">{item.agreement_type}</span></div>
          <div className="summary-grid">
            <div><span>Partner</span><strong>{item.partner.name}</strong></div>
            <div><span>Department</span><strong>{item.department}</strong></div>
            <div><span>Owner</span><strong>{item.owner.full_name}</strong></div>
            <div><span>Strategic alignment</span><strong>{item.strategic_alignment || "Not specified"}</strong></div>
            <div><span>Current stage</span><strong>{item.stage.replaceAll("_", " ")}</strong></div>
            <div><span>Next action</span><strong>{item.next_action || "No action"}</strong></div>
            <div><span>Legal review age</span><strong>{item.legal_review_days == null ? "Not in legal review" : `${item.legal_review_days} days`}</strong></div>
            <div><span>Days to expiry</span><strong>{item.days_to_expiry == null ? "Not set" : item.days_to_expiry}</strong></div>
          </div>
        </div>
        <div className="panel workflow-actions">
          <h3>Workflow actions</h3><p>Available actions depend on your role and current process position.</p>
          <div className="action-list">{actions.filter((action) => action.stages.includes(item.stage) && (!action.statuses || action.statuses.includes(item.status)) && action.roles.includes(user.role)).map((action) => <button key={action.key} onClick={() => transition(action.key)}>{action.label}</button>)}</div>
          {actions.filter((action) => action.stages.includes(item.stage) && (!action.statuses || action.statuses.includes(item.status)) && action.roles.includes(user.role)).length === 0 && <div className="role-readonly-note">No workflow action is assigned to your role at this stage.</div>}
        </div>
      </div>

      <div className="tabs">
        {["overview", "documents", "m&e", "history"].map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name === "m&e" ? "Monitoring & Evaluation" : name}</button>)}
      </div>

      {tab === "overview" && (
        <form className="panel form-section" onSubmit={saveDetails}>
          <div className="panel-head"><div><h3>Lifecycle and activation data</h3><p>Maintain signing, ownership and implementation fields.</p></div>{canEditOverview && <button className="primary-button"><Save size={17} /> Save changes</button>}</div>
          <div className="form-grid form-grid-3">
            <label>Internal champion<input disabled={!canManageLifecycleData} value={edit.internal_champion} onChange={(e) => setEdit({ ...edit, internal_champion: e.target.value })} /></label>
            <label>Partner liaison<input disabled={!canManageLifecycleData} value={edit.partner_liaison} onChange={(e) => setEdit({ ...edit, partner_liaison: e.target.value })} /></label>
            <label>Next action<input disabled={!canEditOverview} value={edit.next_action} onChange={(e) => setEdit({ ...edit, next_action: e.target.value })} /></label>
            <label>Date sent to VC<input type="date" disabled={!canEditOverview} value={edit.date_sent_vc} onChange={(e) => setEdit({ ...edit, date_sent_vc: e.target.value })} /></label>
            <label>Date sent to partner<input type="date" disabled={!canEditOverview} value={edit.date_sent_partner} onChange={(e) => setEdit({ ...edit, date_sent_partner: e.target.value })} /></label>
            <label>Signing date<input type="date" disabled={!canEditOverview} value={edit.signing_date} onChange={(e) => setEdit({ ...edit, signing_date: e.target.value })} /></label>
            <label>Effective date<input type="date" disabled={!canManageLifecycleData} value={edit.effective_date} onChange={(e) => setEdit({ ...edit, effective_date: e.target.value })} /></label>
            <label>Expiry date<input type="date" disabled={!canManageLifecycleData} value={edit.expiry_date} onChange={(e) => setEdit({ ...edit, expiry_date: e.target.value })} /></label>
          </div>
        </form>
      )}

      {tab === "documents" && (
        <div className="detail-tab-grid">
          {canUpload ? <form className="panel form-section" onSubmit={uploadFile}>
            <div className="section-heading"><span><Upload size={18} /></span><div><h3>Upload document</h3><p>Maximum 25 MB. PDF, Office, image, CSV and text formats.</p></div></div>
            <div className="form-grid single-column">
              <label>File<input type="file" onChange={(e) => setUpload({ ...upload, file: e.target.files[0] })} required /></label>
              <label>Document type<select value={upload.document_type} onChange={(e) => setUpload({ ...upload, document_type: e.target.value })}><option value="supporting">Supporting document</option><option value="draft">Draft agreement</option><option value="signed">Signed agreement</option><option value="evidence">M&E evidence</option><option value="template">Template</option></select></label>
              <label>Version<input value={upload.version} onChange={(e) => setUpload({ ...upload, version: e.target.value })} /></label>
              <label>Confidentiality<select value={upload.confidentiality} onChange={(e) => setUpload({ ...upload, confidentiality: e.target.value })}><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="public">Public</option></select></label>
              <label className="checkbox-label"><input type="checkbox" checked={upload.is_official} onChange={(e) => setUpload({ ...upload, is_official: e.target.checked })} /> Mark as official version</label>
              <button className="primary-button"><Upload size={17} /> Upload</button>
            </div>
          </form> : <div className="panel form-section"><EmptyState title="Document upload unavailable" text="Your role or the current lifecycle stage is read-only." /></div>}
          <div className="panel span-2">
            <div className="panel-head"><div><h3>Document repository</h3><p>Controlled agreement files and evidence.</p></div></div>
            {item.documents.length === 0 ? <EmptyState title="No documents uploaded" text="Use the upload form to add the first file." /> : <div className="document-list">{item.documents.map((doc) => (
              <button type="button" key={doc.id} className="document-row" onClick={() => downloadFile(`/agreements/${id}/documents/${doc.id}/download`, doc.original_name).catch((err) => setError(err.message))}>
                <div className="document-icon"><FileText size={21} /></div><div><strong>{doc.original_name}</strong><span>{doc.document_type} · version {doc.version} · {doc.confidentiality} · {(doc.size_bytes / 1024).toFixed(1)} KB</span></div><Download size={18} />
              </button>
            ))}</div>}
          </div>
        </div>
      )}

      {tab === "m&e" && (
        <div className="detail-tab-grid">
          {canManageME ? <form className="panel form-section" onSubmit={addDeliverable}>
            <div className="section-heading"><span><Plus size={18} /></span><div><h3>Add deliverable</h3><p>Capture target and actual implementation outputs.</p></div></div>
            <div className="form-grid single-column">
              <label>Deliverable type<input value={deliverable.deliverable_type} onChange={(e) => setDeliverable({ ...deliverable, deliverable_type: e.target.value })} /></label>
              <label>Target<input type="number" step="0.01" value={deliverable.target_value} onChange={(e) => setDeliverable({ ...deliverable, target_value: Number(e.target.value) })} /></label>
              <label>Actual<input type="number" step="0.01" value={deliverable.actual_value} onChange={(e) => setDeliverable({ ...deliverable, actual_value: Number(e.target.value) })} /></label>
              <label>Reporting period<input value={deliverable.reporting_period} onChange={(e) => setDeliverable({ ...deliverable, reporting_period: e.target.value })} /></label>
              <button className="primary-button"><Plus size={17} /> Add deliverable</button>
            </div>
          </form> : <div className="panel form-section"><EmptyState title="M&E update unavailable" text="Updates are limited by role and lifecycle stage." /></div>}
          <div className="panel span-2">
            <div className="panel-head"><div><h3>Performance deliverables</h3><p>Target versus actual outputs for this agreement.</p></div></div>
            {item.deliverables.length === 0 ? <EmptyState title="No deliverables" /> : <div className="metric-list">{item.deliverables.map((row) => {
              const progressValue = Number(row.target_value) ? Math.min(100, (Number(row.actual_value) / Number(row.target_value)) * 100) : 0;
              return <div className="metric-row" key={row.id}><div><strong>{row.deliverable_type}</strong><span>{row.reporting_period}</span></div><div className="metric-progress"><div><span style={{ width: `${progressValue}%` }} /></div><small>{row.actual_value} / {row.target_value}</small></div></div>;
            })}</div>}
            <hr />
            {canManageValue && <form className="inline-form" onSubmit={addValue}>
              <h4>Add value generated</h4>
              <input placeholder="Value type" value={valueRecord.value_type} onChange={(e) => setValueRecord({ ...valueRecord, value_type: e.target.value })} />
              <input type="number" placeholder="Amount" value={valueRecord.amount} onChange={(e) => setValueRecord({ ...valueRecord, amount: Number(e.target.value) })} />
              <select value={valueRecord.currency} onChange={(e) => setValueRecord({ ...valueRecord, currency: e.target.value })}><option>KES</option><option>USD</option><option>EUR</option></select>
              <button className="secondary-button">Add</button>
            </form>}
            <div className="value-list">{item.values.map((value) => <div key={value.id}><span>{value.value_type}</span><strong>{value.currency} {Number(value.amount).toLocaleString()}</strong></div>)}</div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="panel timeline-panel">
          <div className="panel-head"><div><h3>Workflow history</h3><p>Immutable record of material process actions.</p></div><History size={20} /></div>
          <div className="timeline">{[...item.workflow_events].reverse().map((event) => (
            <div className="timeline-item" key={event.id}><div className="timeline-dot" /><div><strong>{event.action.replaceAll("_", " ")}</strong><p>{event.comment || `${event.from_stage || "Start"} → ${event.to_stage}`}</p><span>{event.actor.full_name} · {new Date(event.created_at).toLocaleString()}</span></div></div>
          ))}</div>
        </div>
      )}
    </>
  );
}
