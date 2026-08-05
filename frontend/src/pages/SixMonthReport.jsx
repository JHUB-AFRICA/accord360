import { ArrowLeft, CheckCircle2, FileUp, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";

export default function SixMonthReport() {
  const { id } = useParams();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const navigate = useNavigate();

  const load = useCallback(() => {
    setError("");
    api(`/me/reports/${id}`)
      .then((data) => { setRecord(data); setForm(data); setReviewNote(data.review_note || ""); })
      .catch((requestError) => setError(requestError.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isChampion = Boolean(form && user.id === form.champion_id);
  const canEditContent = useMemo(
    () => Boolean(form) && (isChampion || user.role === "me") && ["draft", "returned"].includes(form.status),
    [form, isChampion, user.role]
  );
  const canReview = useMemo(
    () => Boolean(form) && ["linkages", "director_linkages", "me"].includes(user.role) && form.status === "submitted",
    [form, user.role]
  );

  if (error && !record) return <><PageHeader eyebrow="Six-month reporting" title="Unable to load report" /><ErrorState message={error} onRetry={load} /></>;
  if (!record || !form) return <LoadingState label="Loading six-month Champion report" />;

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateDeliverable(index, key, value) {
    setForm((current) => ({
      ...current,
      deliverables: current.deliverables.map((item, itemIndex) => itemIndex === index
        ? { ...item, [key]: key === "actual" ? Number(value) : value }
        : item)
    }));
  }

  function validateReadiness() {
    if (!form.activities_completed.trim()) return "Describe the activities completed during the reporting period.";
    if (!form.deliverables.every((item) => item.status)) return "Update the status of every deliverable.";
    if (!form.evidence.length) return "Attach at least one supporting evidence file before submission.";
    return "";
  }

  async function save(status = form.status, extra = {}) {
    if (status === "submitted") {
      const readinessError = validateReadiness();
      if (readinessError) { setError(readinessError); return; }
    }
    if (status === "returned" && !String(extra.review_note || "").trim()) {
      setError("A clear return reason is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const updated = await api(`/me/reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, ...extra, status })
      });
      setRecord(updated);
      setForm(updated);
      setReviewNote(updated.review_note || "");
      setReturnOpen(false);
      setMessage(
        status === "submitted" ? "Six-month report submitted to Linkages."
          : status === "validated" ? "Six-month report validated."
            : status === "returned" ? "Report returned to the Champion for correction."
              : "Report draft saved."
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <>
    <Toast message={message} onClose={() => setMessage("")} />
    <Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader
      eyebrow="Monitoring & evaluation"
      title="Six-month Champion report"
      description={`${record.agreement_reference} · ${record.partner_name}`}
      actions={<button className="secondary-button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Back</button>}
      meta={<StatusBadge status={form.status} />}
    />

    {form.status === "returned" && form.review_note && <div className="form-alert warning"><strong>Correction required:</strong> {form.review_note}</div>}

    <div className="report-form-grid">
      <section className="panel report-form-main">
        <div className="report-period-banner">
          <div><span>Reporting period</span><strong>{record.reporting_period}</strong></div>
          <div><span>Submission deadline</span><strong>{formatDate(record.due_date)}</strong></div>
          <div><span>Champion</span><strong>{record.champion_name}</strong></div>
        </div>

        <div className="form-grid single-column">
          <label className="form-field"><span>Activities completed during this period</span><textarea rows="5" disabled={!canEditContent} value={form.activities_completed} onChange={(event) => update("activities_completed", event.target.value)} /></label>
          <label className="form-field"><span>Key challenges and bottlenecks</span><textarea rows="4" disabled={!canEditContent} value={form.challenges} onChange={(event) => update("challenges", event.target.value)} /></label>
        </div>

        <h2>Outputs achieved versus plan</h2>
        <div className="deliverable-edit-list">
          {form.deliverables.map((item, index) => <article key={item.id}>
            <div><strong>{item.output}</strong><span>{item.responsible_party}</span></div>
            <label>Target<input type="number" disabled value={item.target} /></label>
            <label>Actual<input type="number" disabled={!canEditContent} min="0" value={item.actual} onChange={(event) => updateDeliverable(index, "actual", event.target.value)} /></label>
            <label>Status<select disabled={!canEditContent} value={item.status} onChange={(event) => updateDeliverable(index, "status", event.target.value)}><option value="not_started">Not started</option><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="not_achieved">Not achieved</option></select></label>
          </article>)}
        </div>

        <div className="form-grid">
          <label className="form-field"><span>Partner engagement rating</span><select disabled={!canEditContent} value={form.partner_engagement_rating} onChange={(event) => update("partner_engagement_rating", Number(event.target.value))}><option value="1">1 — Very low</option><option value="2">2 — Low</option><option value="3">3 — Moderate</option><option value="4">4 — Active</option><option value="5">5 — Excellent</option></select></label>
          <label className="form-field"><span>Financial/resource value (KES)</span><input type="number" disabled={!canEditContent} value={form.financial_value} onChange={(event) => update("financial_value", Number(event.target.value))} /></label>
          <label className="form-field"><span>Renewal recommendation</span><select disabled={!canEditContent} value={form.renewal_recommendation} onChange={(event) => update("renewal_recommendation", event.target.value)}><option value="renew">Recommend renewal</option><option value="close">Recommend closure</option><option value="undecided">Undecided</option></select></label>
        </div>

        <label className="upload-zone compact-upload">
          <FileUp />
          <strong>Upload supporting evidence</strong>
          <span>Evidence will be securely attached to this reporting period.</span>
          <input type="file" multiple disabled={!canEditContent} onChange={(event) => update("evidence", [...form.evidence, ...Array.from(event.target.files || []).map((file) => file.name)])} />
        </label>
        <div className="file-chip-list">{form.evidence.map((file) => <span key={file}>{file}</span>)}</div>
      </section>

      <aside className="panel report-form-aside">
        <h2>Report summary</h2>
        <dl className="aside-summary"><div><dt>Agreement</dt><dd>{record.title}</dd></div><div><dt>Period</dt><dd>{record.reporting_period}</dd></div><div><dt>Resource value</dt><dd>{formatCurrency(form.financial_value)}</dd></div><div><dt>Evidence files</dt><dd>{form.evidence.length}</dd></div></dl>
        <hr />
        <h3>Readiness</h3>
        <div className="readiness-list"><span className={form.activities_completed ? "done" : ""}><CheckCircle2 /> Activities completed</span><span className={form.challenges ? "done" : ""}><CheckCircle2 /> Challenges recorded</span><span className={form.deliverables.every((item) => item.status) ? "done" : ""}><CheckCircle2 /> Deliverables updated</span><span className={form.evidence.length ? "done" : ""}><CheckCircle2 /> Evidence attached</span></div>
      </aside>
    </div>

    {canEditContent && <div className="sticky-form-actions"><button className="secondary-button" disabled={submitting} onClick={() => save("draft")}><Save size={17} /> Save draft</button><button className="primary-button" disabled={submitting} onClick={() => save("submitted")}>Submit to Linkages</button></div>}
    {canReview && <div className="sticky-form-actions"><button className="secondary-button" disabled={submitting} onClick={() => setReturnOpen(true)}>Return for correction</button><button className="primary-button" disabled={submitting} onClick={() => save("validated", { review_note: reviewNote })}>Validate report</button></div>}

    <Modal
      open={returnOpen}
      onClose={() => setReturnOpen(false)}
      title="Return report for correction"
      description="The Champion will receive this exact correction request."
      footer={<><button className="secondary-button" onClick={() => setReturnOpen(false)}>Cancel</button><button className="danger-button" disabled={submitting} onClick={() => save("returned", { review_note: reviewNote })}>Return report</button></>}
    >
      <label className="form-field"><span>Required correction *</span><textarea rows="5" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="State what must be corrected and why." /></label>
    </Modal>
  </>;
}
