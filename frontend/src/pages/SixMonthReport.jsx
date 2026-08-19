import { ArrowLeft, FileUp, Save, ShieldCheck, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { createDeliverable, createValueRecord, getAgreement, updateDeliverable, uploadAgreementDocument } from "../lib/backend.js";
import { formatDate, formatNumber } from "../lib/format.js";

const emptyForm = {
  deliverable_id: "",
  deliverable_type: "",
  target_value: "",
  actual_value: "",
  reporting_period: "",
  notes: "",
  value_type: "",
  amount: "",
  currency: "KES",
  source: ""
};

export default function SixMonthReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agreement, setAgreement] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [evidence, setEvidence] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try { setAgreement(await getAgreement(id)); }
    catch (requestError) { setError(requestError.message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const selectedDeliverable = useMemo(
    () => agreement?.deliverables?.find((item) => Number(item.id) === Number(form.deliverable_id)),
    [agreement, form.deliverable_id]
  );

  function chooseDeliverable(value) {
    const item = agreement.deliverables.find((entry) => Number(entry.id) === Number(value));
    if (!item) {
      setForm({ ...emptyForm, reporting_period: form.reporting_period });
      return;
    }
    setForm((current) => ({
      ...current,
      deliverable_id: String(item.id),
      deliverable_type: item.deliverable_type || "",
      target_value: String(item.target_value ?? ""),
      actual_value: String(item.actual_value ?? ""),
      reporting_period: item.reporting_period || current.reporting_period,
      notes: item.notes || ""
    }));
  }

  async function saveUpdate(event) {
    event.preventDefault();
    if (!form.deliverable_type.trim() || form.target_value === "" || form.actual_value === "") {
      setError("Deliverable, target and actual values are required.");
      return;
    }
    if (Number(form.target_value) < 0 || Number(form.actual_value) < 0) {
      setError("Target and actual values cannot be negative.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let evidenceDocumentId = selectedDeliverable?.evidence_document_id || null;
      if (evidence) {
        const uploaded = await uploadAgreementDocument(agreement.id, {
          file: evidence,
          documentType: "evidence",
          version: "1.0",
          confidentiality: "internal",
          isOfficial: false
        });
        evidenceDocumentId = Number(uploaded.id);
      }
      const payload = {
        deliverable_type: form.deliverable_type.trim(),
        target_value: Number(form.target_value),
        actual_value: Number(form.actual_value),
        reporting_period: form.reporting_period.trim() || null,
        notes: form.notes.trim() || null,
        evidence_document_id: evidenceDocumentId
      };
      if (form.deliverable_id) await updateDeliverable(agreement.id, form.deliverable_id, payload);
      else await createDeliverable(agreement.id, payload);

      if (form.amount !== "") {
        await createValueRecord(agreement.id, {
          value_type: form.value_type.trim() || "Partnership resource value",
          amount: Number(form.amount),
          currency: form.currency.trim().toUpperCase() || "KES",
          source: form.source.trim() || null,
          reporting_period: form.reporting_period.trim() || null,
          approved: true
        });
      }
      setMessage(form.deliverable_id ? "Monitoring deliverable updated." : "Monitoring deliverable recorded.");
      setForm(emptyForm);
      setEvidence(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !agreement) return <><PageHeader eyebrow="Monitoring & evaluation" title="Six-month update" /><ErrorState message={error} onRetry={load} /></>;
  if (!agreement) return <LoadingState label="Loading agreement monitoring data" />;

  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Monitoring & evaluation" title="Six-month partnership update" description={`${agreement.reference} · ${agreement.partner_name}`} actions={<button className="secondary-button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Back</button>} meta={<StatusBadge status={agreement.status}>{agreement.status.replaceAll("_", " ")}</StatusBadge>} />
    <div className="inline-alert info"><ShieldCheck size={18} /><div><strong>Implemented backend model</strong><p>The API currently stores monitoring data as deliverables, evidence documents and value records. This form writes only to those supported endpoints.</p></div></div>

    <div className="content-grid two-column">
      <section className="panel">
        <div className="panel-head"><div><h2>Recorded deliverables</h2><p>{agreement.deliverables.length} monitoring item{agreement.deliverables.length === 1 ? "" : "s"}</p></div><TrendingUp size={20} /></div>
        {agreement.deliverables.length ? <div className="deliverable-list">{agreement.deliverables.map((item) => {
          const target = Number(item.target_value || 0);
          const actual = Number(item.actual_value || 0);
          const progress = target > 0 ? Math.min(100, Math.round(actual / target * 100)) : actual > 0 ? 100 : 0;
          return <article key={item.id}><div className="deliverable-head"><div><strong>{item.deliverable_type}</strong><span>{item.reporting_period || "Reporting period not recorded"}</span></div><StatusBadge tone={progress >= 100 ? "green" : progress >= 60 ? "blue" : "orange"}>{progress}%</StatusBadge></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="deliverable-metrics"><span>Target <b>{formatNumber(target)}</b></span><span>Actual <b>{formatNumber(actual)}</b></span><span>Evidence <b>{item.evidence_document_id ? `Document #${item.evidence_document_id}` : "Missing"}</b></span></div><button className="text-button" type="button" onClick={() => chooseDeliverable(String(item.id))}>Update this deliverable</button></article>;
        })}</div> : <div className="inline-empty">No deliverables have been recorded for this agreement.</div>}
        <div className="panel-divider" />
        <h3>Recorded value</h3>
        {agreement.values.length ? <div className="value-list">{agreement.values.map((item) => <article key={item.id}><strong>{item.currency} {Number(item.amount).toLocaleString()}</strong><span>{item.value_type} · {item.reporting_period || "No period"}</span><small>{item.approved ? "Approved" : "Pending approval"} · {item.source || "No source recorded"}</small></article>)}</div> : <p>No partnership value records are available.</p>}
        <p className="form-help">Agreement effective period: {formatDate(agreement.effective_date)} – {formatDate(agreement.expiry_date)}</p>
      </section>

      <form className="panel" onSubmit={saveUpdate}>
        <div className="panel-head"><div><h2>{form.deliverable_id ? "Update deliverable" : "Add monitoring update"}</h2><p>Target and actual values must be non-negative.</p></div></div>
        <label className="form-field"><span>Existing deliverable</span><select value={form.deliverable_id} onChange={(event) => chooseDeliverable(event.target.value)}><option value="">Create a new deliverable</option>{agreement.deliverables.map((item) => <option key={item.id} value={item.id}>{item.deliverable_type}</option>)}</select></label>
        <label className="form-field"><span>Deliverable / output *</span><input value={form.deliverable_type} onChange={(event) => setForm({ ...form, deliverable_type: event.target.value })} /></label>
        <div className="form-grid"><label className="form-field"><span>Target *</span><input type="number" min="0" step="any" value={form.target_value} onChange={(event) => setForm({ ...form, target_value: event.target.value })} /></label><label className="form-field"><span>Actual *</span><input type="number" min="0" step="any" value={form.actual_value} onChange={(event) => setForm({ ...form, actual_value: event.target.value })} /></label></div>
        <label className="form-field"><span>Reporting period</span><input value={form.reporting_period} onChange={(event) => setForm({ ...form, reporting_period: event.target.value })} placeholder="2026 H1" /></label>
        <label className="form-field"><span>Progress notes</span><textarea rows="5" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        <label className="upload-zone compact-upload-zone"><FileUp size={22} /><strong>{evidence ? evidence.name : "Upload supporting evidence"}</strong><span>Optional supported document, maximum 25 MB.</span><input type="file" onChange={(event) => setEvidence(event.target.files?.[0] || null)} /></label>
        <div className="panel-divider" />
        <h3>Optional financial or resource value</h3>
        <div className="form-grid"><label className="form-field"><span>Value type</span><input value={form.value_type} onChange={(event) => setForm({ ...form, value_type: event.target.value })} placeholder="Research funding" /></label><label className="form-field"><span>Amount</span><input type="number" min="0" step="any" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label className="form-field"><span>Currency</span><input value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} /></label><label className="form-field"><span>Source</span><input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></label></div>
        <button className="primary-button full-width" type="submit" disabled={saving}><Save size={17} /> {saving ? "Saving…" : form.deliverable_id ? "Update monitoring record" : "Save monitoring record"}</button>
      </form>
    </div>
  </>;
}
