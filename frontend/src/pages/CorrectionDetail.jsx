import { AlertTriangle, ArrowLeft, FileUp, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getCorrection, resolveCorrection, respondCorrection, uploadAgreementDocument } from "../lib/backend.js";
import { formatDateTime, humanize } from "../lib/format.js";

export default function CorrectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [response, setResponse] = useState("");
  const [replacement, setReplacement] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try { setRecord(await getCorrection(id)); } catch (requestError) { setError(requestError.message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  if (error && !record) return <><PageHeader eyebrow="Correction workspace" title="Correction details" /><ErrorState message={error} onRetry={load} /></>;
  if (!record) return <LoadingState label="Loading correction details" />;

  const canRespond = record.status === "pending" && ((record.return_action === "return_correction" && ["researcher", "linkages", "director_linkages"].includes(user.role)) || (record.return_action === "return_dvc" && user.role === "legal"));
  const canResolve = record.status === "responded" && (user.role === "admin" || user.role === record.requested_by?.role || (["linkages", "director_linkages"].includes(user.role) && ["linkages", "director_linkages"].includes(record.requested_by?.role)));

  async function submitResponse() {
    if (!response.trim()) { setError("Add a response describing how the requested correction was addressed."); return; }
    setSubmitting(true); setError("");
    try {
      if (replacement) await uploadAgreementDocument(record.agreement_id, { file: replacement, documentType: "supporting", version: "1.0", confidentiality: "internal", isOfficial: false });
      setRecord(await respondCorrection(record.id, response.trim()));
      setReplacement(null); setResponse(""); setMessage("Correction response recorded and the agreement advanced through its workflow.");
    } catch (requestError) { setError(requestError.message); } finally { setSubmitting(false); }
  }

  async function submitResolution() {
    if (!response.trim()) { setError("Add resolution notes before closing this correction."); return; }
    setSubmitting(true); setError("");
    try { setRecord(await resolveCorrection(record.id, response.trim())); setResponse(""); setMessage("Correction resolved and retained in the audit history."); }
    catch (requestError) { setError(requestError.message); } finally { setSubmitting(false); }
  }

  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Correction workspace" title={record.agreement_title} description={`${record.agreement_reference} · ${record.partner_name}`} actions={<button className="secondary-button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Back</button>} meta={<StatusBadge status={record.status}>{humanize(record.status)}</StatusBadge>} />
    <div className="inline-alert warning"><AlertTriangle size={19} /><div><strong>{record.status === "resolved" ? "Correction resolved" : "Correction required"}</strong><p>{record.requested_change}</p></div></div>
    <div className="content-grid two-column">
      <section className="panel">
        <div className="panel-head"><div><h2>Correction record</h2><p>Persisted separately and linked to the immutable workflow return event.</p></div><ShieldCheck size={20} /></div>
        <dl className="detail-list">
          <div><dt>Requested by</dt><dd>{record.requested_by?.full_name || "Authorized reviewer"}</dd></div>
          <div><dt>Return action</dt><dd>{humanize(record.return_action)}</dd></div>
          <div><dt>Date issued</dt><dd>{formatDateTime(record.created_at)}</dd></div>
          <div><dt>Exact item</dt><dd>{record.exact_item}</dd></div>
          <div><dt>Assigned to</dt><dd>{record.assigned_to?.full_name || "Responsible workflow owner"}</dd></div>
          {record.details && <div><dt>Additional context</dt><dd>{record.details}</dd></div>}
        </dl>
        <Link className="text-link" to={`/agreements/${record.agreement_id}?tab=corrections`}>Open full agreement and document history</Link>
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>{record.status === "responded" ? "Resolution" : "Correction response"}</h2><p>{record.status === "responded" ? "The requesting review function can close the correction with resolution notes." : "Upload a replacement document where needed, then record an auditable response."}</p></div></div>
        {record.response_text && <div className="inline-alert info"><ShieldCheck size={18} /><div><strong>Response recorded</strong><p>{record.response_text}</p></div></div>}
        {record.status === "pending" && <>
          <label className="form-field"><span>Response details *</span><textarea rows="7" value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Explain the exact field, clause or document changed and identify the replacement version." /></label>
          <label className="upload-zone compact-upload-zone"><FileUp size={22} /><strong>{replacement ? replacement.name : "Attach replacement document"}</strong><span>Optional. The backend accepts supported document types up to 25 MB.</span><input type="file" onChange={(event) => setReplacement(event.target.files?.[0] || null)} /></label>
        </>}
        {canRespond && <button className="primary-button full-width" disabled={submitting} onClick={submitResponse}><Send size={17} /> {submitting ? "Submitting…" : "Submit correction response"}</button>}
        {canResolve && <><label className="form-field"><span>Resolution notes *</span><textarea rows="5" value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Confirm the correction was reviewed and resolved." /></label><button className="primary-button full-width" disabled={submitting} onClick={submitResolution}><ShieldCheck size={17} /> {submitting ? "Resolving…" : "Resolve correction"}</button></>}
        {!canRespond && !canResolve && record.status !== "resolved" && <div className="inline-alert info"><ShieldCheck size={18} /><div><strong>Awaiting the responsible role</strong><p>The backend authorizes responses and resolution only for the assigned workflow function.</p></div></div>}
        {record.resolution_notes && <div className="inline-alert success"><ShieldCheck size={18} /><div><strong>Resolution notes</strong><p>{record.resolution_notes}</p></div></div>}
      </section>
    </div>
  </>;
}
