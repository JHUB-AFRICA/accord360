import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Toast from "../components/Toast";
import { api } from "../lib/api";

const initial = { name: "", sector: "", partner_type: "Institution", country: "Kenya", contact_name: "", contact_email: "", legal_counterpart: "", liaison: "", status: "active" };

export default function Partners() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() { setItems(await api("/partners")); }
  useEffect(() => { load(); }, []);
  async function submit(event) {
    event.preventDefault();
    try {
      await api("/partners", { method: "POST", body: JSON.stringify({ ...form, contact_email: form.contact_email || null }) });
      setMessage("Partner created."); setForm(initial); setShowForm(false); await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader eyebrow="Partner registry" title="Partners" description="Maintain clean partner profiles, contacts, legal counterparts and institutional history." actions={<button className="primary-button" onClick={() => setShowForm(!showForm)}><Plus size={18} /> Add partner</button>} />
      {showForm && <form className="panel form-section partner-form" onSubmit={submit}>
        <div className="panel-head"><div><h3>New partner profile</h3><p>Create one authoritative record and prevent duplicate entries.</p></div></div>
        <div className="form-grid form-grid-3">
          {Object.entries(form).map(([key, value]) => key === "partner_type" ? <label key={key}>Partner type<select value={value} onChange={(e) => setForm({ ...form, [key]: e.target.value })}><option>Institution</option><option>University</option><option>Company</option><option>Government</option><option>NGO</option><option>Development Partner</option></select></label> : key === "status" ? <label key={key}>Status<select value={value} onChange={(e) => setForm({ ...form, [key]: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label> : <label key={key}>{key.replaceAll("_", " ")}<input type={key === "contact_email" ? "email" : "text"} required={["name", "sector"].includes(key)} value={value} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
        </div><button className="primary-button"><Plus size={17} /> Save partner</button>
      </form>}
      {items.length === 0 ? <div className="panel"><EmptyState title="No partners found" /></div> : <div className="partner-grid">{items.map((item) => (
        <article className="partner-card panel" key={item.id}>
          <div className="partner-card-top"><div className="partner-avatar"><Building2 size={22} /></div><span className={`partner-status ${item.status}`}>{item.status}</span></div>
          <h3>{item.name}</h3><p>{item.sector} · {item.country}</p>
          <div className="partner-meta"><div><span>Type</span><strong>{item.partner_type}</strong></div><div><span>Contact</span><strong>{item.contact_name || "Not set"}</strong></div><div><span>Liaison</span><strong>{item.liaison || "Not set"}</strong></div></div>
        </article>
      ))}</div>}
    </>
  );
}
