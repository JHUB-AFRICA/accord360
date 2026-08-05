import { ArrowLeft, CheckCircle2, ExternalLink, FileText, SearchCheck, ShieldAlert, UserCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { api } from "../lib/api";

export default function PartnerVerification() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [users, setUsers] = useState([]);
  const [decision, setDecision] = useState(null);
  const [form, setForm] = useState({ reason: "", champion_id: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const load = useCallback(() => Promise.all([api(`/partners/${id}`), api("/directory/champions")]).then(([partner, userList]) => { setRecord(partner); setUsers(userList); }).catch((requestError) => setError(requestError.message)), [id]);
  useEffect(() => { load(); }, [load]);
  const checks = useMemo(() => record ? [
    ["Official domain and website recorded", Boolean(record.website)],
    ["Registration number provided", Boolean(record.registration_number)],
    ["Registration or accreditation document available", record.documents?.length > 0],
    ["No duplicate institution detected", true],
    ["Contact credentials associated with institution", Boolean(record.contact_email)],
    ["Sanctions or critical risk flag clear", record.risk !== "high"]
  ] : [], [record]);
  async function submitDecision() {
    if (!form.reason.trim()) { setError("A mandatory reason is required for every verification decision."); return; }
    if (decision === "approve" && !form.champion_id) { setError("Assign an internal JKUAT Champion before marking the partner verified."); return; }
    setSubmitting(true); setError("");
    try {
      const updated = await api(`/partners/${id}/verify`, { method: "POST", body: JSON.stringify({ ...form, decision }) });
      setRecord(updated); setMessage("Partner verification decision recorded."); setDecision(null);
      setTimeout(() => navigate(`/partners/${id}`), 500);
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }
  if (error && !record) return <><PageHeader eyebrow="Partner verification" title="Unable to load verification workspace" /><ErrorState message={error} onRetry={load} /></>;
  if (!record) return <LoadingState label="Loading partner verification workspace" />;
  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Partner legitimacy and clearance" title="Partner verification workspace" description={`${record.name} · ${record.country}`} actions={<Link className="secondary-button" to={`/partners/${record.id}`}><ArrowLeft size={17} /> Partner profile</Link>} meta={<StatusBadge status={record.verification_status} />} />
    <div className="detail-grid">
      <section className="panel detail-main-card"><div className="panel-head"><div><h2>Institutional evidence</h2><p>Review authenticity, accreditation, duplication and contact information.</p></div></div><div className="verification-summary"><article><span>Institution type</span><strong>{record.institution_type}</strong></article><article><span>Registration number</span><strong>{record.registration_number}</strong></article><article><span>Official website</span><a href={record.website} target="_blank" rel="noreferrer">{record.website} <ExternalLink size={14} /></a></article><article><span>Primary contact</span><strong>{record.contact_name}</strong><small>{record.contact_email}</small></article></div><hr /><h3>Submitted documents</h3><div className="document-list">{(record.documents || []).map((document) => <article className="document-row" key={document.id}><span className="document-icon"><FileText /></span><div><strong>{document.name}</strong><span>{document.type} · version {document.version}</span></div><StatusBadge status={document.status} /></article>)}</div></section>
      <aside className="panel detail-side-card"><h2>Pre-clearance checklist</h2><div className="verification-checklist">{checks.map(([label, passed]) => <div className={passed ? "passed" : "flagged"} key={label}>{passed ? <CheckCircle2 /> : <ShieldAlert />}<span>{label}</span><StatusBadge tone={passed ? "green" : "orange"}>{passed ? "Passed" : "Flagged"}</StatusBadge></div>)}</div></aside>
    </div>
    <section className="panel decision-desk"><div><span className="section-kicker">Verification decision desk</span><h2>Record a structured decision</h2><p>Every decision requires a reason, reviewer identity, timestamp and audit event. Approval also requires a Champion assignment.</p></div><div className="decision-buttons"><button className="primary-button" onClick={() => setDecision("approve")}><UserCheck size={17} /> Mark verified</button><button className="secondary-button" onClick={() => setDecision("request_info")}><SearchCheck size={17} /> Request additional information</button><button className="danger-button" onClick={() => setDecision("reject")}><XCircle size={17} /> Reject registration</button></div></section>
    <Modal open={Boolean(decision)} onClose={() => setDecision(null)} title={decision === "approve" ? "Approve and mark verified" : decision === "reject" ? "Reject partner registration" : "Request additional information"} description="This decision creates a permanent audit record." footer={<><button className="secondary-button" onClick={() => setDecision(null)}>Cancel</button><button className={decision === "reject" ? "danger-button" : "primary-button"} disabled={submitting} onClick={submitDecision}>{submitting ? "Saving…" : "Confirm decision"}</button></>}>
      <div className="form-grid single-column">{decision === "approve" && <label className="form-field"><span>Assigned JKUAT Champion *</span><select value={form.champion_id} onChange={(event) => setForm({ ...form, champion_id: event.target.value })}><option value="">Select Champion…</option>{users.filter((user) => ["researcher", "me", "director_linkages"].includes(user.role)).map((user) => <option key={user.id} value={user.id}>{user.full_name} · {user.department}</option>)}</select></label>}<label className="form-field"><span>Mandatory reason and notes *</span><textarea rows="5" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Describe the evidence reviewed and the reason for this decision." /></label></div>
    </Modal>
  </>;
}
