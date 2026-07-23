import { useEffect, useState } from "react";
import { BellRing, Bot, Plus, Save, SlidersHorizontal, Tags } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Toast from "../components/Toast";
import { api } from "../lib/api";

export default function Settings() {
  const [criteria, setCriteria] = useState([]);
  const [weights, setWeights] = useState({});
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [faqs, setFaqs] = useState([]);
  const [faqForm, setFaqForm] = useState(null); // null | { id?, question, answer, keywords, category }
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const config = await api("/scorecard/config");
    setCriteria(config);
    setWeights(Object.fromEntries(config.map((c) => [c.key, c.weight])));
    setCategories(await api("/template-categories"));
    setFaqs(await api("/chatbot/faqs"));
  }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  const total = Object.values(weights).reduce((s, w) => s + Number(w || 0), 0);

  async function saveWeights(e) {
    e.preventDefault();
    try {
      const payload = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, Number(v)]));
      await api("/scorecard/config", { method: "PUT", body: JSON.stringify({ weights: payload }) });
      setMessage("Scorecard weights updated."); await load();
    } catch (err) { setError(err.message); }
  }

  async function addCategory(e) {
    e.preventDefault();
    try {
      await api("/template-categories", { method: "POST", body: JSON.stringify(newCategory) });
      setNewCategory({ name: "", description: "" }); setMessage("Partner category added."); await load();
    } catch (err) { setError(err.message); }
  }

  async function saveFaq(e) {
    e.preventDefault();
    try {
      const body = JSON.stringify({ question: faqForm.question, answer: faqForm.answer, keywords: faqForm.keywords, category: faqForm.category, is_active: true });
      if (faqForm.id) await api(`/chatbot/faqs/${faqForm.id}`, { method: "PUT", body });
      else await api("/chatbot/faqs", { method: "POST", body });
      setFaqForm(null); setMessage("FAQ saved."); await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <PageHeader eyebrow="Administration console" title="System settings" description="Adjust scorecard weights, partner categories and the chatbot knowledge base. All changes are audit-logged." />
      <Toast message={message} type="success" onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />

      <section className="panel form-section">
        <div className="section-heading"><span><SlidersHorizontal size={18} /></span><div><h3>Scorecard weights (BR-009)</h3><p>Weights must total exactly 100%. Applied immediately to the partnership scorecard.</p></div></div>
        <form onSubmit={saveWeights}>
          <div className="form-grid form-grid-3">
            {criteria.map((c) => (
              <label key={c.key}>{c.label}
                <input type="number" min="0" max="100" value={weights[c.key] ?? ""} onChange={(e) => setWeights({ ...weights, [c.key]: e.target.value })} />
              </label>
            ))}
          </div>
          <div className="form-footer">
            <span className={total === 100 ? "gate-pass" : "gate-pending"}>Total: {total}% {total === 100 ? "✓" : "(must equal 100)"}</span>
            <button className="primary-button" disabled={total !== 100}><Save size={16} /> Save weights</button>
          </div>
        </form>
      </section>

      <section className="panel form-section">
        <div className="section-heading"><span><Tags size={18} /></span><div><h3>Partner categories (BR-003)</h3><p>Categories drive the template library and intake classification.</p></div></div>
        <div className="weight-strip">{categories.map((c) => <div key={c.id} className="weight-chip" title={c.description || ""}><span>{c.name}</span></div>)}</div>
        <form className="inline-form" onSubmit={addCategory}>
          <input placeholder="New category name" required value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} />
          <input placeholder="Description" value={newCategory.description} onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} style={{ minWidth: "220px" }} />
          <button className="secondary-button"><Plus size={15} /> Add category</button>
        </form>
      </section>

      <section className="panel form-section">
        <div className="section-heading"><span><Bot size={18} /></span><div><h3>Chatbot knowledge base (BR-008)</h3><p>FAQ entries answered by the public guidance assistant. It never provides legal advice.</p></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Question</th><th>Category</th><th>Keywords</th><th /></tr></thead>
            <tbody>{faqs.map((f) => (
              <tr key={f.id}>
                <td data-label="Question"><strong>{f.question}</strong><span>{f.answer.slice(0, 90)}…</span></td>
                <td data-label="Category">{f.category}</td>
                <td data-label="Keywords">{f.keywords}</td>
                <td data-label="Edit"><button className="secondary-button" onClick={() => setFaqForm({ id: f.id, question: f.question, answer: f.answer, keywords: f.keywords, category: f.category })}>Edit</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <button className="secondary-button" style={{ marginTop: "0.8rem" }} onClick={() => setFaqForm({ question: "", answer: "", keywords: "", category: "General" })}><Plus size={15} /> New FAQ</button>
        {faqForm && (
          <form className="form-grid" onSubmit={saveFaq} style={{ marginTop: "1rem" }}>
            <label className="full-span">Question<input required value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} /></label>
            <label className="full-span">Answer<textarea rows="3" required value={faqForm.answer} onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })} /></label>
            <label>Keywords (comma-separated)<input value={faqForm.keywords} onChange={(e) => setFaqForm({ ...faqForm, keywords: e.target.value })} /></label>
            <label>Category<input value={faqForm.category} onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })} /></label>
            <div className="form-footer full-span"><button className="secondary-button" type="button" onClick={() => setFaqForm(null)}>Cancel</button><button className="primary-button"><Save size={16} /> Save FAQ</button></div>
          </form>
        )}
      </section>

      <section className="panel form-section">
        <div className="section-heading"><span><BellRing size={18} /></span><div><h3>SLA and alert rules</h3><p>Currently enforced system rules (fixed in this release).</p></div></div>
        <div className="weight-strip">
          <div className="weight-chip"><strong>21 days</strong><span>Legal review window</span></div>
          <div className="weight-chip"><strong>6 months</strong><span>M&E reporting cycle</span></div>
          <div className="weight-chip"><strong>30 days</strong><span>Report due alert window</span></div>
          <div className="weight-chip"><strong>183 / 90 days</strong><span>Expiry warning / critical</span></div>
          <div className="weight-chip"><strong>180 days</strong><span>Dormancy trigger</span></div>
        </div>
      </section>
    </>
  );
}
