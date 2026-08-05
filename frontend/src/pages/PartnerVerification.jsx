import { ArrowLeft, CheckCircle2, SearchCheck, UserCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { getPartner, updatePartner } from "../lib/backend.js";

export default function PartnerVerification() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => getPartner(id).then((partner) => {
    if (!partner) throw new Error("Partner not found.");
    setRecord(partner);
  }).catch((requestError) => setError(requestError.message)), [id]);

  useEffect(() => { load(); }, [load]);

  async function submitDecision() {
    if (!reason.trim()) {
      setError("A mandatory reason is required for every review decision.");
      return;
    }
    const status = decision === "approve" ? "active" : decision === "request_info" ? "additional_information_required" : "rejected";
    setSubmitting(true);
    try {
      const payload = {
        name: record.name,
        sector: record.sector,
        partner_type: record.partner_type,
        country: record.country,
        contact_name: record.contact_name || null,
        contact_email: record.contact_email || null,
        legal_counterpart: record.legal_counterpart || null,
        liaison: record.liaison || null,
        status
      };
      const updated = await updatePartner(record.id, payload);
      setRecord(updated);
      setMessage(`Partner status updated to ${status}. Review note: ${reason.trim()}`);
      setDecision(null);
      setReason("");
      setTimeout(() => navigate(`/partners/${record.id}`), 600);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !record) return <><PageHeader eyebrow="Partner review" title="Unable to load partner" /><ErrorState message={error} onRetry={load} /></>;
  if (!record) return <LoadingState label="Loading partner review workspace" />;

  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Partner status review" title="Partner verification workspace" description={`${record.name} · ${record.country}`} actions={<Link className="secondary-button" to={`/partners/${record.id}`}><ArrowLeft size={17} /> Partner profile</Link>} meta={<StatusBadge status={record.status} />} />
    <div className="detail-grid">
      <section className="panel detail-main-card"><div className="panel-head"><div><h2>Institutional record</h2><p>The backend currently exposes partner master data but not a dedicated verification-evidence endpoint.</p></div></div><div className="verification-summary"><article><span>Partner type</span><strong>{record.partner_type}</strong></article><article><span>Sector</span><strong>{record.sector}</strong></article><article><span>Country</span><strong>{record.country}</strong></article><article><span>Primary contact</span><strong>{record.contact_name || "Not recorded"}</strong><small>{record.contact_email || "No email"}</small></article></div></section>
      <aside className="panel detail-side-card"><h2>Available checks</h2><div className="verification-checklist"><div className={record.name ? "passed" : "flagged"}><CheckCircle2 /><span>Institution name recorded</span></div><div className={record.sector ? "passed" : "flagged"}><CheckCircle2 /><span>Sector recorded</span></div><div className={record.country ? "passed" : "flagged"}><CheckCircle2 /><span>Country recorded</span></div><div className={record.contact_email ? "passed" : "flagged"}><CheckCircle2 /><span>Contact email recorded</span></div></div><p className="helper-note">Champion assignment is performed when a Linkages user creates an agreement with champion_user_id. It is not a partner-profile field in the current API.</p></aside>
    </div>
    <section className="panel decision-desk"><div><span className="section-kicker">Status decision</span><h2>Update the partner record</h2><p>The current backend supports PUT /partners/{id}. The selected status is saved with the complete PartnerCreate body.</p></div><div className="decision-buttons"><button className="primary-button" onClick={() => setDecision("approve")}><UserCheck size={17} /> Mark active</button><button className="secondary-button" onClick={() => setDecision("request_info")}><SearchCheck size={17} /> Request information</button><button className="danger-button" onClick={() => setDecision("reject")}><XCircle size={17} /> Reject</button></div></section>
    <Modal open={Boolean(decision)} onClose={() => setDecision(null)} title={decision === "approve" ? "Mark partner active" : decision === "reject" ? "Reject partner" : "Request additional information"} description="The review reason is shown in this confirmation but the current partner schema has no review-notes field." footer={<><button className="secondary-button" onClick={() => setDecision(null)}>Cancel</button><button className={decision === "reject" ? "danger-button" : "primary-button"} disabled={submitting} onClick={submitDecision}>{submitting ? "Saving…" : "Confirm decision"}</button></>}><label className="form-field"><span>Mandatory review reason *</span><textarea rows="5" value={reason} onChange={(event) => setReason(event.target.value)} /></label></Modal>
  </>;
}
