import { useEffect, useState } from "react";
import { Inbox, Plus, UserCheck, X } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const initial = { partner_name: "", sector: "", category: "", country: "Kenya", county: "", collaboration_area: "", contact_name: "", contact_email: "", notes: "" };

export default function PartnerRequests() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [champions, setChampions] = useState([]);
  const [form, setForm] = useState(initial);
  const [show, setShow] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [championId, setChampionId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canLog = ["linkages", "admin"].includes(user?.role);

  async function load() {
    const data = await api("/partner-requests");
    setItems(data);
  }
  useEffect(() => {
    load().catch((err) => setError(err.message));
    api("/template-categories").then(setCategories).catch(() => {});
    if (canLog) api("/users").then((all) => setChampions(all.filter((u) => u.role === "champion" && u.is_active))).catch(() => {});
  }, []);

  function change(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  async function submit(e) {
    e.preventDefault();
    try {
      const payload = { ...form };
      for (const key of ["sector", "category", "county", "contact_name", "contact_email", "notes"]) if (!payload[key]) payload[key] = null;
      await api("/partner-requests", { method: "POST", body: JSON.stringify(payload) });
      setMessage("Partner request logged.");
      setForm(initial); setShow(false); await load();
    } catch (err) { setError(err.message); }
  }

  async function assign(e) {
    e.preventDefault();
    try {
      await api(`/partner-requests/${assigning}/assign-champion`, { method: "POST", body: JSON.stringify({ champion_id: Number(championId) }) });
      setMessage("JKUAT Champion assigned and notified.");
      setAssigning(null); setChampionId(""); await load();
    } catch (err) { setError(err.message); }
  }

  async function decline(id) {
    if (!window.confirm("Decline this partner request?")) return;
    try { await api(`/partner-requests/${id}/decline`, { method: "POST" }); await load(); } catch (err) { setError(err.message); }
  }

  const statusLabel = { logged: "Logged — awaiting Champion", champion_assigned: "Champion assigned", converted: "Converted to agreement", declined: "Declined" };

  return (
    <>
      <PageHeader
        eyebrow="Partner-originated intake"
        title="Partner requests"
        description="Linkages logs incoming partner requests. Drafting is blocked until an internal JKUAT Champion is assigned (BR-002)."
        actions={canLog && <button className="primary-button" onClick={() => setShow(!show)}><Plus size={17} /> Log partner request</button>}
      />
      <Toast message={message} type="success" onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />

      {show && (
        <form className="panel form-section" onSubmit={submit} style={{ marginBottom: "1rem" }}>
          <div className="section-heading"><span>New</span><div><h3>Log partner request</h3><p>Capture the partner profile and proposed collaboration area.</p></div></div>
          <div className="form-grid">
            <label>Partner name<input name="partner_name" value={form.partner_name} onChange={change} required /></label>
            <label>Sector<input name="sector" value={form.sector} onChange={change} /></label>
            <label>Partner category<select name="category" value={form.category} onChange={change}><option value="">Select category</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
            <label>Country<input name="country" value={form.country} onChange={change} /></label>
            <label>County (if Kenya)<input name="county" value={form.county} onChange={change} /></label>
            <label>Contact name<input name="contact_name" value={form.contact_name} onChange={change} /></label>
            <label>Contact email<input type="email" name="contact_email" value={form.contact_email} onChange={change} /></label>
            <label className="full-span">Proposed collaboration area<textarea name="collaboration_area" value={form.collaboration_area} onChange={change} required rows="3" /></label>
            <label className="full-span">Notes<textarea name="notes" value={form.notes} onChange={change} rows="2" /></label>
          </div>
          <div className="form-footer"><button className="primary-button">Log request</button></div>
        </form>
      )}

      <section className="panel">
        <div className="panel-head"><div><h3>Intake register</h3><p>Every partner approach is recorded before any drafting starts.</p></div><Inbox size={20} /></div>
        {items.length === 0 ? (
          <EmptyState title="No partner requests" text={user?.role === "champion" ? "Requests routed to you by Linkages will appear here." : "Log a partner-originated request to begin the intake workflow."} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Partner</th><th>Category</th><th>Collaboration area</th><th>JKUAT Champion</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Partner"><strong>{item.partner_name}</strong><span>{item.country}{item.county ? ` · ${item.county}` : ""}</span></td>
                  <td data-label="Category">{item.category || "—"}</td>
                  <td data-label="Area">{item.collaboration_area}</td>
                  <td data-label="Champion">{item.champion ? item.champion.full_name : "Not assigned"}</td>
                  <td data-label="Status">{statusLabel[item.status] || item.status}</td>
                  <td data-label="Actions">
                    {canLog && ["logged", "champion_assigned"].includes(item.status) && (
                      <button className="secondary-button" onClick={() => { setAssigning(item.id); setChampionId(item.champion?.id || ""); }}><UserCheck size={15} /> {item.champion ? "Reassign" : "Assign Champion"}</button>
                    )}
                    {item.status === "champion_assigned" && (user?.role === "admin" || user?.role === "linkages" || user?.id === item.champion?.id) && (
                      <Link className="secondary-button" to={`/agreements/new?request=${item.id}`}>Start drafting</Link>
                    )}
                    {canLog && ["logged", "champion_assigned"].includes(item.status) && (
                      <button className="icon-button" title="Decline" onClick={() => decline(item.id)}><X size={15} /></button>
                    )}
                    {item.status === "converted" && item.agreement_id && <Link className="secondary-button" to={`/agreements/${item.agreement_id}`}>Open agreement</Link>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {assigning && (
        <form className="panel form-section" onSubmit={assign} style={{ marginTop: "1rem" }}>
          <div className="section-heading"><span>Route</span><div><h3>Assign internal JKUAT Champion</h3><p>The Champion is notified and becomes responsible for initiating drafting.</p></div></div>
          <div className="form-grid">
            <label>Champion<select value={championId} onChange={(e) => setChampionId(e.target.value)} required><option value="">Select Champion</option>{champions.map((c) => <option key={c.id} value={c.id}>{c.full_name} — {c.department || "JKUAT"}</option>)}</select></label>
          </div>
          <div className="form-footer"><button className="secondary-button" type="button" onClick={() => setAssigning(null)}>Cancel</button><button className="primary-button">Assign</button></div>
        </form>
      )}
    </>
  );
}
