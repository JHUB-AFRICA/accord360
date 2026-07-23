import { useEffect, useState } from "react";
import { FileStack, Pencil, Plus } from "lucide-react";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const initial = { name: "", agreement_type: "MoU", partner_category: "", description: "", body: "" };

export default function Templates() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const canManage = ["admin", "linkages"].includes(user?.role);

  async function load() {
    const query = canManage ? "?include_inactive=true" : "";
    setItems(await api(`/templates${query}`));
  }
  useEffect(() => {
    load().catch((err) => setError(err.message));
    api("/template-categories").then(setCategories).catch(() => {});
  }, []);

  function change(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  function startEdit(item) {
    setEditing(item.id);
    setForm({ name: item.name, agreement_type: item.agreement_type, partner_category: item.partner_category, description: item.description || "", body: item.body || "" });
    setShow(true);
  }

  async function submit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api(`/templates/${editing}`, { method: "PUT", body: JSON.stringify({ name: form.name, description: form.description, body: form.body }) });
        setMessage("Template updated. Content changes create a new version; existing agreements keep the version they used.");
      } else {
        await api("/templates", { method: "POST", body: JSON.stringify(form) });
        setMessage("Template created.");
      }
      setForm(initial); setEditing(null); setShow(false); await load();
    } catch (err) { setError(err.message); }
  }

  const visible = filterCat ? items.filter((t) => t.partner_category === filterCat) : items;

  return (
    <>
      <PageHeader
        eyebrow="Configurable template library"
        title="Agreement templates"
        description="Templates are organised by agreement type and partner category (BR-003). Each agreement records the exact template version used (FR-008)."
        actions={canManage && <button className="primary-button" onClick={() => { setEditing(null); setForm(initial); setShow(!show); }}><Plus size={17} /> New template</button>}
      />
      <Toast message={message} type="success" onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />

      {show && (
        <form className="panel form-section" onSubmit={submit} style={{ marginBottom: "1rem" }}>
          <div className="section-heading"><span>{editing ? "Edit" : "New"}</span><div><h3>{editing ? "Edit template" : "Create template"}</h3><p>Body edits automatically increment the template version.</p></div></div>
          <div className="form-grid">
            <label>Name<input name="name" value={form.name} onChange={change} required /></label>
            <label>Agreement type<select name="agreement_type" value={form.agreement_type} onChange={change} disabled={!!editing}><option>MoU</option><option>CRA</option><option>CA</option><option>Other</option></select></label>
            <label>Partner category<select name="partner_category" value={form.partner_category} onChange={change} required disabled={!!editing}><option value="">Select category</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
            <label className="full-span">Description<input name="description" value={form.description} onChange={change} /></label>
            <label className="full-span">Template body<textarea name="body" value={form.body} onChange={change} rows="8" placeholder="Clauses, placeholders and standard language for this partner category." /></label>
          </div>
          <div className="form-footer"><button className="secondary-button" type="button" onClick={() => { setShow(false); setEditing(null); }}>Cancel</button><button className="primary-button">{editing ? "Save changes" : "Create template"}</button></div>
        </form>
      )}

      <section className="panel">
        <div className="panel-head">
          <div><h3>Library</h3><p>Recommended automatically when Champions select agreement type and partner category.</p></div>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
        </div>
        {visible.length === 0 ? (
          <EmptyState title="No templates" text="Create templates per partner category so Champions start from approved language." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Template</th><th>Type</th><th>Partner category</th><th>Version</th><th>Status</th>{canManage && <th />}</tr></thead>
              <tbody>{visible.map((item) => (
                <tr key={item.id}>
                  <td data-label="Template"><strong>{item.name}</strong><span>{item.description}</span></td>
                  <td data-label="Type">{item.agreement_type}</td>
                  <td data-label="Category">{item.partner_category}</td>
                  <td data-label="Version">v{item.version}</td>
                  <td data-label="Status">{item.is_active ? "Active" : "Inactive"}</td>
                  {canManage && <td data-label="Edit"><button className="icon-button" onClick={() => startEdit(item)}><Pencil size={15} /></button></td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
