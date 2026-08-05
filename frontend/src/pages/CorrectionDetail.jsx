import { ArrowLeft, CheckCircle2, ExternalLink, FileUp, MessageSquareText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/format";

export default function CorrectionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [response, setResponse] = useState("");
  const [replacement, setReplacement] = useState(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const load = useCallback(() => { setError(""); api(`/corrections/${id}`).then((data) => { setRecord(data); setResponse(data.response || ""); }).catch((requestError) => setError(requestError.message)); }, [id]);
  useEffect(() => { load(); }, [load]);
  if (error && !record) return <><PageHeader eyebrow="Correction workspace" title="Unable to load correction" /><ErrorState message={error} onRetry={load} /></>;
  if (!record) return <LoadingState label="Loading correction details" />;
  const canRespond = ["partner", "researcher", "linkages", "director_linkages"].includes(user.role) && record.status !== "resolved";
  const canResolve = ["linkages", "director_linkages", "legal", "approver"].includes(user.role) && record.status === "submitted";
  async function submitResponse() {
    if (!response.trim()) { setError("Explain the correction or replacement you are submitting."); return; }
    setSubmitting(true); setError("");
    try {
      const updated = await api(`/corrections/${id}/respond`, { method: "POST", body: JSON.stringify({ response, replacement_document: replacement ? { name: replacement.name, size: replacement.size, type: replacement.type } : null }) });
      setRecord(updated); setMessage("Correction response submitted for review.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }
  async function resolveCorrection() {
    setSubmitting(true); setError("");
    try {
      const updated = await api(`/corrections/${id}/resolve`, { method: "POST", body: JSON.stringify({ note: resolveNote }) });
      setRecord(updated); setMessage("Correction marked resolved."); setResolveOpen(false);
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }
  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Correction workspace" title={record.code} description={`${record.agreement_reference} · ${record.agreement_title}`} actions={<button className="secondary-button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Back</button>} meta={<StatusBadge status={record.status} />} />
    <div className="correction-detail-grid">
      <section className="panel correction-main-card"><div className="correction-banner"><MessageSquareText /><div><strong>{record.category}</strong><span>{record.exact_item}</span></div><StatusBadge status={record.status} /></div><div className="info-grid"><div className="info-item"><span>Requested by</span><strong>{record.requested_by}</strong></div><div className="info-item"><span>Issued</span><strong>{formatDateTime(record.created_at)}</strong></div><div className="info-item"><span>Due date</span><strong>{formatDate(record.due_date)}</strong></div><div className="info-item"><span>Notification</span><strong>{record.notification_status}</strong></div></div><hr /><h3>Reason</h3><p className="long-copy">{record.reason}</p><div className="change-comparison"><article><span>Previous value or state</span><p>{record.previous_value}</p></article><article><span>Requested change</span><p>{record.requested_change}</p></article></div><Link className="deep-link-card" to={record.deep_link || `/agreements/${record.agreement_id}`}><ExternalLink /><div><strong>Open exact affected item</strong><span>{record.exact_item}</span></div></Link></section>
      <aside className="panel correction-history-card"><h2>Correction history</h2><div className="history-event"><span className="timeline-dot" /><div><strong>Correction requested</strong><p>{record.requested_by}</p><small>{formatDateTime(record.created_at)}</small></div></div>{record.responded_at && <div className="history-event"><span className="timeline-dot" /><div><strong>Response submitted</strong><p>{record.responded_by}</p><small>{formatDateTime(record.responded_at)}</small></div></div>}{record.resolved_at && <div className="history-event"><span className="timeline-dot" /><div><strong>Marked resolved</strong><p>{record.resolved_by}</p><small>{formatDateTime(record.resolved_at)}</small></div></div>}</aside>
    </div>
    {canRespond && <section className="panel response-card"><div className="panel-head"><div><h2>Submit correction response</h2><p>Describe the change and attach the corrected or new document where relevant.</p></div></div><label className="form-field"><span>Response and correction details *</span><textarea rows="5" value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Explain what was changed and where the reviewer can verify it." /></label><label className="upload-zone compact-upload"><FileUp /><strong>{replacement ? replacement.name : "Attach corrected or replacement document"}</strong><span>PDF, DOCX or XLSX up to the configured file-size limit</span><input type="file" onChange={(event) => setReplacement(event.target.files?.[0] || null)} /></label><div className="form-actions-right"><button className="secondary-button" onClick={() => setResponse(record.response || "")}>Reset</button><button className="primary-button" disabled={submitting} onClick={submitResponse}>{submitting ? "Submitting…" : "Submit response"}</button></div></section>}
    {record.response && <section className="panel submitted-response"><div><CheckCircle2 /><div><h2>Submitted response</h2><p>{record.response}</p>{record.replacement_document && <span>{record.replacement_document.name}</span>}</div></div>{canResolve && <button className="primary-button" onClick={() => setResolveOpen(true)}>Accept and mark resolved</button>}</section>}
    <Modal open={resolveOpen} onClose={() => setResolveOpen(false)} title="Resolve correction" description="Confirm that the response fully addresses the requested change." footer={<><button className="secondary-button" onClick={() => setResolveOpen(false)}>Cancel</button><button className="primary-button" disabled={submitting} onClick={resolveCorrection}>{submitting ? "Saving…" : "Mark resolved"}</button></>}><label className="form-field"><span>Resolution note</span><textarea rows="4" value={resolveNote} onChange={(event) => setResolveNote(event.target.value)} placeholder="Record why the correction was accepted." /></label></Modal>
  </>;
}
