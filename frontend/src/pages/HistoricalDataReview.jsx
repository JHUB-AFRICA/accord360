import { CheckCircle2, ClipboardCheck, Save, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getHistoricalReview, listChampions, listHistoricalReviews, updateHistoricalReview, verifyHistoricalReview } from "../lib/backend.js";
import { formatDate } from "../lib/format.js";

const emptyForm = { title: "", agreement_type: "Other", purpose: "", expected_outcomes: "", strategic_alignment: "", department: "", effective_date: "", expiry_date: "", owner_id: "", partner_liaison: "", status: "", stage: "", status_color: "", next_action: "", data_quality_note: "" };

export default function HistoricalDataReview() {
  const { user } = useAuth();
  const [records, setRecords] = useState(null);
  const [selected, setSelected] = useState(null);
  const [champions, setChampions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("pending_review");

  const load = useCallback(async () => {
    setError("");
    try {
      const [items, users] = await Promise.all([listHistoricalReviews(reviewStatus), listChampions()]);
      setRecords(items);
      setChampions(users);
      if (items.length) {
        const detail = await getHistoricalReview(items[0].id);
        setSelected(detail);
        setFormFrom(detail);
      }
    } catch (requestError) { setError(requestError.message); }
  }, [reviewStatus]);

  function setFormFrom(item) {
    setForm({ ...emptyForm, title: item.title || "", agreement_type: item.agreement_type || "Other", purpose: item.purpose || "", expected_outcomes: item.expected_outcomes || "", strategic_alignment: item.strategic_alignment || "", department: item.department === "Not recorded" ? "" : item.department || "", effective_date: item.effective_date || "", expiry_date: item.expiry_date || "", owner_id: item.owner?.id ? String(item.owner.id) : "", partner_liaison: item.partner_liaison || "", status: item.status || "", stage: item.stage || "", status_color: item.status_color || "", next_action: item.next_action || "", data_quality_note: item.data_quality_note || "" });
  }

  useEffect(() => { load(); }, [load]);

  async function selectRecord(item) {
    setError("");
    try { const detail = await getHistoricalReview(item.id); setSelected(detail); setFormFrom(detail); } catch (requestError) { setError(requestError.message); }
  }

  const visible = useMemo(() => (records || []).filter((item) => `${item.reference_number} ${item.title} ${item.partner?.name || ""}`.toLowerCase().includes(search.toLowerCase())), [records, search]);

  async function save() {
    if (!selected) return;
    setSaving(true); setError("");
    try {
      const payload = { ...form, owner_id: form.owner_id ? Number(form.owner_id) : null, effective_date: form.effective_date || null, expiry_date: form.expiry_date || null, department: form.department || "Not recorded" };
      const updated = await updateHistoricalReview(selected.id, payload);
      setSelected(updated); setFormFrom(updated); setRecords((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage("Corrections saved. The record remains pending review.");
    } catch (requestError) { setError(requestError.message); } finally { setSaving(false); }
  }

  async function verify() {
    if (!selected) return;
    setSaving(true); setError("");
    try { await save(); await verifyHistoricalReview(selected.id, form.data_quality_note || "Reviewed by Linkages"); setMessage("Record verified and removed from the pending queue."); setSelected(null); setRecords((current) => current.filter((item) => item.id !== selected.id)); } catch (requestError) { setError(requestError.message); } finally { setSaving(false); }
  }

  if (error && !records) return <><PageHeader eyebrow="Data stewardship" title="Historical data review" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading historical review queue" />;

  const field = (name, label, type = "text") => <label className="form-field"><span>{label}</span><input type={type} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} /></label>;
  return <>
    <Toast message={message} onClose={() => setMessage("")} />
    <Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Data stewardship" title="Historical data review" description="Review imported partnership records before they become verified operational data." actions={<select aria-label="Historical review status" value={reviewStatus} onChange={(event) => { setRecords(null); setSelected(null); setReviewStatus(event.target.value); }}><option value="pending_review">Needs review</option><option value="in_review">In review</option><option value="verified">Verified</option></select>} meta={<span className="scope-note"><ClipboardCheck size={15} /> Linkages review only</span>} />
    <div className="inline-alert info"><ClipboardCheck size={18} /><div><strong>{records.length} records awaiting review</strong><p>Source values remain available on each record. Corrections are audited.</p></div></div>
    <div className="review-layout">
      <section className="panel data-panel"><div className="search-field"><Search size={17} /><input aria-label="Search historical records" placeholder="Search reference, partner or title…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="review-list">{visible.map((item) => <button type="button" className={`review-list-item ${selected?.id === item.id ? "active" : ""}`} key={item.id} onClick={() => selectRecord(item)}><strong>{item.reference_number}</strong><span>{item.partner?.name || "Unknown partner"}</span><small>{item.title}</small></button>)}{!visible.length && <p className="empty-state">No matching pending records.</p>}</div></section>
      {selected ? <section className="panel"><div className="panel-head"><div><span className="section-kicker">{selected.reference_number}</span><h2>{selected.partner?.name}</h2><p>Source row {selected.source_row_number || "—"} · {selected.source_section || "Section not recorded"}</p></div><StatusBadge tone="orange">Pending review</StatusBadge></div><div className="inset-panel"><h3>Original source</h3><p><strong>Date:</strong> {selected.source_date_raw || "Not recorded"}</p><p><strong>Type:</strong> {selected.source_type_raw || "Not recorded"}</p><p><strong>Status:</strong> {selected.source_status_raw || "Not recorded"}</p><p><strong>Purpose:</strong> {selected.source_purpose_raw || "Not recorded"}</p></div><div className="form-grid">{field("title", "Agreement title")}<label className="form-field"><span>Agreement type</span><select value={form.agreement_type} onChange={(event) => setForm({ ...form, agreement_type: event.target.value })}>{["MoU", "CRA", "CA", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label>{field("department", "Department")}{field("partner_liaison", "Partner liaison")}{field("effective_date", "Effective date", "date")}{field("expiry_date", "Expiry date", "date")}<label className="form-field"><span>Champion / owner</span><select value={form.owner_id} onChange={(event) => setForm({ ...form, owner_id: event.target.value })}><option value="">Select Champion…</option>{champions.map((item) => <option value={item.id} key={item.id}>{item.full_name} · {item.department || "No department"}</option>)}</select></label>{field("status", "Status")}{field("stage", "Stage")}{field("status_color", "Status color")}{field("next_action", "Next action")}<label className="form-field span-2"><span>Purpose</span><textarea rows="4" value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} /></label><label className="form-field span-2"><span>Review notes</span><textarea rows="3" value={form.data_quality_note} onChange={(event) => setForm({ ...form, data_quality_note: event.target.value })} /></label></div><div className="page-actions"><button className="secondary-button" disabled={saving} onClick={save}><Save size={16} /> Save corrections</button><button className="primary-button" disabled={saving || !form.owner_id} onClick={verify}><CheckCircle2 size={16} /> Mark verified</button></div></section> : <section className="panel empty-state"><ClipboardCheck size={30} /><h2>Select a record</h2><p>Choose a pending historical record to compare its source data and correct the imported fields.</p></section>}
    </div>
  </>;
}
