import { AlertTriangle, ArrowLeft, FileUp, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getAgreement, transitionAgreement, uploadAgreementDocument } from "../lib/backend.js";
import { formatDateTime, humanize } from "../lib/format.js";

function latestReturnEvent(record) {
  return [...(record?.workflow_events || [])].reverse().find((event) => ["return_correction", "return_dvc", "reject"].includes(event.action));
}

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
    try {
      setRecord(await getAgreement(id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  const returnEvent = useMemo(() => latestReturnEvent(record), [record]);

  if (error && !record) return <><PageHeader eyebrow="Correction workspace" title="Correction details" /><ErrorState message={error} onRetry={load} /></>;
  if (!record) return <LoadingState label="Loading correction details" />;

  const canResubmit = record.status === "correction_required" && ["researcher", "linkages", "director_linkages"].includes(user.role);
  const canReapproveLegal = record.status === "dvc_returned" && user.role === "legal";
  const action = canResubmit ? "submit" : canReapproveLegal ? "approve_legal" : null;

  async function submitResponse() {
    if (!action) return;
    if (!response.trim()) {
      setError("Add a response describing how the requested correction was addressed.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (replacement) {
        await uploadAgreementDocument(record.id, {
          file: replacement,
          documentType: "supporting",
          version: "1.0",
          confidentiality: "internal",
          isOfficial: false
        });
      }
      const updated = await transitionAgreement(record.id, action, response.trim());
      setRecord(updated);
      setMessage(action === "submit" ? "Correction response submitted for departmental review." : "Corrected Legal package approved and returned to DVC RPE endorsement.");
      setReplacement(null);
      setResponse("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Correction workspace" title={record.title} description={`${record.reference} · ${record.partner_name}`} actions={<button className="secondary-button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Back</button>} meta={<StatusBadge status={record.status}>{humanize(record.status)}</StatusBadge>} />

    <div className="inline-alert warning"><AlertTriangle size={19} /><div><strong>Correction required</strong><p>{returnEvent?.comment || record.current_action || "Review the latest workflow return and address the requested changes."}</p></div></div>

    <div className="content-grid two-column">
      <section className="panel">
        <div className="panel-head"><div><h2>Return record</h2><p>Derived from the immutable agreement workflow history.</p></div><ShieldCheck size={20} /></div>
        <dl className="detail-list">
          <div><dt>Requested by</dt><dd>{returnEvent?.actor?.full_name || "Authorized reviewer"}</dd></div>
          <div><dt>Action</dt><dd>{humanize(returnEvent?.action || "return")}</dd></div>
          <div><dt>Date issued</dt><dd>{formatDateTime(returnEvent?.created_at)}</dd></div>
          <div><dt>Backend stage</dt><dd>{humanize(record.backend_stage)}</dd></div>
          <div><dt>Required next action</dt><dd>{record.current_action}</dd></div>
        </dl>
        <Link className="text-link" to={`/agreements/${record.id}?tab=corrections`}>Open full agreement and document history</Link>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Correction response</h2><p>Upload a replacement document where needed, then record an auditable response.</p></div></div>
        <label className="form-field"><span>Response and resolution details *</span><textarea rows="7" value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Explain the exact field, clause or document changed and identify the replacement version." /></label>
        <label className="upload-zone compact-upload-zone"><FileUp size={22} /><strong>{replacement ? replacement.name : "Attach replacement document"}</strong><span>Optional. The backend accepts supported document types up to 25 MB.</span><input type="file" onChange={(event) => setReplacement(event.target.files?.[0] || null)} /></label>
        {action ? <button className="primary-button full-width" disabled={submitting} onClick={submitResponse}><Send size={17} /> {submitting ? "Submitting…" : canResubmit ? "Resubmit corrected request" : "Approve corrected Legal package"}</button> : <div className="inline-alert info"><ShieldCheck size={18} /><div><strong>No transition available for your role</strong><p>You may review the return history. The backend authorizes only the responsible role to perform the next workflow action.</p></div></div>}
      </section>
    </div>
  </>;
}
