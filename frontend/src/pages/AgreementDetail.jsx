import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileCheck2, FileText, History, Pencil, Plus, Save, Upload } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import LifecycleStrip from "../components/LifecycleStrip";
import PageHeader from "../components/PageHeader";
import SlaBadge from "../components/SlaBadge";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const actions = [
  { key: "submit", label: "Submit request", stages: ["initiation"], roles: ["researcher", "admin", "linkages"] },
  { key: "approve_department", label: "Approve department", stages: ["department_approval"], roles: ["approver", "admin"] },
  { key: "return_correction", label: "Return for correction", stages: ["department_approval", "linkages_review", "legal_review"], roles: ["approver", "linkages", "legal", "admin"] },
  { key: "approve_linkages", label: "Approve to legal", stages: ["linkages_review"], roles: ["linkages", "admin"] },
  { key: "send_legal", label: "Send to legal", stages: ["linkages_review"], roles: ["linkages", "admin"] },
  { key: "approve_legal", label: "Approve legal draft", stages: ["legal_review"], roles: ["legal", "admin"] },
  { key: "send_signing", label: "Send for signing", stages: ["validation_signing"], roles: ["linkages", "admin"] },
  { key: "mark_signed", label: "Mark fully signed", stages: ["validation_signing"], roles: ["linkages", "admin"] },
  { key: "activate", label: "Activate agreement", stages: ["validation_signing"], roles: ["linkages", "admin"] },
  { key: "renew", label: "Start renewal", stages: ["active"], roles: ["linkages", "executive", "admin"] },
  { key: "close", label: "Close", stages: ["active", "renewal_closure"], roles: ["linkages", "executive", "admin"] },
  { key: "archive", label: "Archive", stages: ["renewal_closure"], roles: ["linkages", "admin"] },
  { key: "reject", label: "Reject", stages: ["department_approval", "linkages_review", "legal_review", "validation_signing"], roles: ["approver", "linkages", "legal", "executive", "admin"] }
];

export default function AgreementDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [tab, setTab] = useState("overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [upload, setUpload] = useState({ file: null, document_type: "supporting", version: "1.0", is_official: false });
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

  async function transition(action) {
    const requiresReason = ["return_correction", "reject"].includes(action);
    const promptText = requiresReason ? "A reason is required for this action:" : "Add a workflow comment (optional):";
    const comment = window.prompt(promptText, "");
    if (comment === null) return;
    if (requiresReason && !comment.trim()) {
      setError("A reason is required when returning or rejecting a request.");
      return;
    }
    try {
      await api(`/agreements/${id}/transition`, { method: "POST", body: JSON.stringify({ action, comment: comment.trim() || null }) });
      setMessage("Workflow updated successfully.");
      await load();
    } catch (err) { setError(err.message); }
  }

  async function saveDetails(event) {
    event.preventDefault();
    const payload = { ...edit };
    Object.keys(payload).forEach((key) => { if (payload[key] === "") payload[key] = null; });
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
    data.append("is_official", upload.is_official);
    try {
      await api(`/agreements/${id}/documents`, { method: "POST", body: data });
      setMessage("Document uploaded.");
      setUpload({ file: null, document_type: "supporting", version: "1.0", is_official: false });
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

  async function updateDeliverable(row) {
    const raw = window.prompt(`Update actual value for ${row.deliverable_type}:`, String(row.actual_value));
    if (raw === null) return;
    const actual = Number(raw);
    if (Number.isNaN(actual) || actual < 0) {
      setError("Enter a valid non-negative actual value.");
      return;
    }
    try {
      await api(`/agreements/${id}/deliverables/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({
          deliverable_type: row.deliverable_type,
          target_value: Number(row.target_value),
          actual_value: actual,
          reporting_period: row.reporting_period,
          notes: row.notes || null
        })
      });
      setMessage("Deliverable actual updated.");
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

  const canEditLifecycle = ["admin", "linkages"].includes(user.role);
  const canEditMe = item.stage === "active" && ["admin", "linkages", "me", "researcher"].includes(user.role);
  const canAddValue = item.stage === "active" && ["admin", "linkages", "me", "executive"].includes(user.role);
  const canUploadDocument = ["admin", "linkages", "legal", "me"].includes(user.role) || (user.role === "researcher" && item.owner.id === user.id);

  async function downloadDocument(doc) {
    try {
      const blob = await api(`/agreements/${id}/documents/${doc.id}/download`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.original_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  }

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

      <LifecycleStrip currentStage={item.stage} status={item.status} compact />

      <div className="detail-top-grid">
        <div className="panel detail-summary span-2">
          <div className="summary-title"><div><h3>Request summary</h3><p>{item.purpose}</p></div><span className="type-pill">{item.agreement_type}</span></div>
          <div className="summary-grid">
            <div><span>Partner</span><strong>{item.partner.name}</strong></div>
            <div><span>Department</span><strong>{item.department}</strong></div>
            <div><span>Owner</span><strong>{item.owner.full_name}</strong></div>
            <div><span>Strategic alignment</span><strong>{item.strategic_alignment || "Not specified"}</strong></div>
            <div><span>Current stage</span><strong>{item.stage.replaceAll("_", " ")}</strong></div>
            <div><span>Stage timer</span><SlaBadge state={item.sla_state} days={item.days_in_stage} target={item.sla_target_days} /></div>
            <div><span>Expiry position</span><strong>{item.expiry_days === null ? "Not set" : item.expiry_days < 0 ? `${Math.abs(item.expiry_days)} days overdue` : `${item.expiry_days} days remaining`}</strong></div>
            <div><span>Next action</span><strong>{item.next_action || "No action"}</strong></div>
          </div>
        </div>
        <div className="panel workflow-actions">
          <h3>Workflow actions</h3><p>Available actions depend on your role and current process position.</p>
          <div className="action-list">{actions.filter((action) => action.stages.includes(item.stage) && action.roles.includes(user.role)).map((action) => <button key={action.key} onClick={() => transition(action.key)}>{action.label}</button>)}</div>
        </div>
      </div>

      <div className="tabs">
        {["overview", "documents", "m&e", "history"].map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name === "m&e" ? "Monitoring & Evaluation" : name}</button>)}
      </div>

      {tab === "overview" && (
        <form className="panel form-section" onSubmit={saveDetails}>
          <div className="panel-head"><div><h3>Lifecycle and activation data</h3><p>{canEditLifecycle ? "Maintain signing, ownership and implementation fields." : "Read-only lifecycle information for your role."}</p></div>{canEditLifecycle && <button className="primary-button"><Save size={17} /> Save changes</button>}</div>
          <fieldset className="form-fieldset" disabled={!canEditLifecycle}>
          <div className="form-grid form-grid-3">
            <label>Internal champion<input value={edit.internal_champion} onChange={(e) => setEdit({ ...edit, internal_champion: e.target.value })} /></label>
            <label>Partner liaison<input value={edit.partner_liaison} onChange={(e) => setEdit({ ...edit, partner_liaison: e.target.value })} /></label>
            <label>Next action<input value={edit.next_action} onChange={(e) => setEdit({ ...edit, next_action: e.target.value })} /></label>
            <label>Date sent to VC<input type="date" value={edit.date_sent_vc} onChange={(e) => setEdit({ ...edit, date_sent_vc: e.target.value })} /></label>
            <label>Date sent to partner<input type="date" value={edit.date_sent_partner} onChange={(e) => setEdit({ ...edit, date_sent_partner: e.target.value })} /></label>
            <label>Signing date<input type="date" value={edit.signing_date} onChange={(e) => setEdit({ ...edit, signing_date: e.target.value })} /></label>
            <label>Effective date<input type="date" value={edit.effective_date} onChange={(e) => setEdit({ ...edit, effective_date: e.target.value })} /></label>
            <label>Expiry date<input type="date" value={edit.expiry_date} onChange={(e) => setEdit({ ...edit, expiry_date: e.target.value })} /></label>
          </div>
          </fieldset>
        </form>
      )}

      {tab === "documents" && (
        <div className="detail-tab-grid">
          {canUploadDocument ? <form className="panel form-section" onSubmit={uploadFile}>
            <div className="section-heading"><span><Upload size={18} /></span><div><h3>Upload document</h3><p>Maximum 25 MB. PDF, Office, image, CSV and text formats.</p></div></div>
            <div className="form-grid single-column">
              <label>File<input type="file" onChange={(e) => setUpload({ ...upload, file: e.target.files[0] })} required /></label>
              <label>Document type<select value={upload.document_type} onChange={(e) => setUpload({ ...upload, document_type: e.target.value })}><option value="supporting">Supporting document</option><option value="draft">Draft agreement</option><option value="signed">Signed agreement</option><option value="evidence">M&E evidence</option><option value="template">Template</option></select></label>
              <label>Version<input value={upload.version} onChange={(e) => setUpload({ ...upload, version: e.target.value })} /></label>
              <label className="checkbox-label"><input type="checkbox" checked={upload.is_official} onChange={(e) => setUpload({ ...upload, is_official: e.target.checked })} /> Mark as official version</label>
              <button className="primary-button"><Upload size={17} /> Upload</button>
            </div>
          </form> : <div className="panel form-section read-only-card"><h3>Secure document access</h3><p>Your role can view authorized documents but cannot upload or replace files.</p></div>}
          <div className="panel span-2">
            <div className="panel-head"><div><h3>Document repository</h3><p>Controlled agreement files and evidence.</p></div></div>
            {item.documents.length === 0 ? <EmptyState title="No documents uploaded" text="Use the upload form to add the first file." /> : <div className="document-list">{item.documents.map((doc) => (
              <button key={doc.id} type="button" className="document-row document-download" onClick={() => downloadDocument(doc)}>
                <div className="document-icon"><FileText size={21} /></div><div><strong>{doc.original_name}</strong><span>{doc.document_type} · version {doc.version} · {(doc.size_bytes / 1024).toFixed(1)} KB{doc.is_official ? " · official" : ""}</span></div><Download size={18} />
              </button>
            ))}</div>}
          </div>
        </div>
      )}

      {tab === "m&e" && (
        <div className="detail-tab-grid">
          {canEditMe ? <form className="panel form-section" onSubmit={addDeliverable}>
            <div className="section-heading"><span><Plus size={18} /></span><div><h3>Add deliverable</h3><p>Capture target and actual implementation outputs.</p></div></div>
            <div className="form-grid single-column">
              <label>Deliverable type<input value={deliverable.deliverable_type} onChange={(e) => setDeliverable({ ...deliverable, deliverable_type: e.target.value })} /></label>
              <label>Target<input type="number" step="0.01" value={deliverable.target_value} onChange={(e) => setDeliverable({ ...deliverable, target_value: Number(e.target.value) })} /></label>
              <label>Actual<input type="number" step="0.01" value={deliverable.actual_value} onChange={(e) => setDeliverable({ ...deliverable, actual_value: Number(e.target.value) })} /></label>
              <label>Reporting period<input value={deliverable.reporting_period} onChange={(e) => setDeliverable({ ...deliverable, reporting_period: e.target.value })} /></label>
              <label>Implementation notes<textarea rows="3" value={deliverable.notes} onChange={(e) => setDeliverable({ ...deliverable, notes: e.target.value })} /></label>
              <button className="primary-button"><Plus size={17} /> Add deliverable</button>
            </div>
          </form> : <div className="panel form-section read-only-card"><h3>M&E access</h3><p>Your role can view performance results but cannot create or update deliverables.</p></div>}
          <div className="panel span-2">
            <div className="panel-head"><div><h3>Performance deliverables</h3><p>Target versus actual outputs for this agreement.</p></div></div>
            {item.deliverables.length === 0 ? <EmptyState title="No deliverables" /> : <div className="metric-list">{item.deliverables.map((row) => {
              const progressValue = Number(row.target_value) ? Math.min(100, (Number(row.actual_value) / Number(row.target_value)) * 100) : 0;
              return <div className="metric-row" key={row.id}><div><strong>{row.deliverable_type}</strong><span>{row.reporting_period}{row.notes ? ` · ${row.notes}` : ""}</span></div><div className="metric-progress"><div><span style={{ width: `${progressValue}%` }} /></div><small>{row.actual_value} / {row.target_value}</small></div>{canEditMe && <button className="icon-button metric-edit" type="button" onClick={() => updateDeliverable(row)} title="Update actual"><Pencil size={16} /></button>}</div>;
            })}</div>}
            <div className="evidence-callout"><FileCheck2 size={20} /><div><strong>Implementation evidence</strong><span>{item.documents.filter((doc) => doc.document_type === "evidence").length} evidence file(s) attached to this agreement.</span></div>{canEditMe && <button type="button" className="secondary-button" onClick={() => { setUpload({ ...upload, document_type: "evidence" }); setTab("documents"); }}>Upload evidence</button>}</div>
            <hr />
            {canAddValue && <form className="inline-form" onSubmit={addValue}>
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
