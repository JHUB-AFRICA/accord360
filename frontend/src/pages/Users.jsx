import { Plus, Search, UserCog } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { api } from "../lib/api";
import { ALL_ROLES, roleConfig } from "../lib/roles";
import { formatDate } from "../lib/format";

const emptyForm = { full_name: "", email: "", password: "", role: "researcher", department: "", faculty: "" };

export default function Users() {
  const [records, setRecords] = useState(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const load = useCallback(() => { setError(""); api("/users").then(setRecords).catch((requestError) => setError(requestError.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => (records || []).filter((item) => [item.full_name, item.email, item.department, roleConfig(item.role).label].some((value) => String(value).toLowerCase().includes(search.toLowerCase()))), [records, search]);
  async function createUser() {
    if (!form.full_name || !form.email || !form.password) { setError("Full name, email and temporary password are required."); return; }
    setSubmitting(true); setError("");
    try { await api("/users", { method: "POST", body: JSON.stringify(form) }); setMessage("User account created."); setShowCreate(false); setForm(emptyForm); await load(); }
    catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }
  async function updateUser(item, changes) {
    try { const updated = await api(`/users/${item.id}`, { method: "PATCH", body: JSON.stringify(changes) }); setRecords((current) => current.map((record) => record.id === updated.id ? updated : record)); setMessage("User access updated."); }
    catch (requestError) { setError(requestError.message); }
  }
  const columns = useMemo(() => [
    { key: "full_name", label: "User", render: (item) => <div className="user-cell"><span className="avatar avatar-small"><UserCog size={16} /></span><div><strong>{item.full_name}</strong><span>{item.email}</span></div></div> },
    { key: "department", label: "Department", render: (item) => <div className="stacked-cell"><strong>{item.department || "—"}</strong><span>{item.faculty || "—"}</span></div> },
    { key: "role", label: "Role", render: (item) => <select className="inline-select" value={item.role} onChange={(event) => updateUser(item, { role: event.target.value })}>{ALL_ROLES.map((role) => <option key={role} value={role}>{roleConfig(role).label}</option>)}</select> },
    { key: "is_active", label: "Status", render: (item) => <button className="status-button" onClick={() => updateUser(item, { is_active: !item.is_active })}><StatusBadge tone={item.is_active ? "green" : "slate"}>{item.is_active ? "Active" : "Inactive"}</StatusBadge></button> },
    { key: "created_at", label: "Created", render: (item) => formatDate(item.created_at) }
  ], [records]);
  if (error && !records) return <><PageHeader eyebrow="Role-based access control" title="Users and roles" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading users and roles" />;
  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Role-based access control" title="Users and roles" description="Provision accounts, assign institutional responsibility, activate or deactivate access and reassign pending work through authorized workflows." actions={<button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} /> Add user</button>} />
    <section className="kpi-grid compact-kpis"><article className="kpi-card"><span>Total users</span><strong>{records.length}</strong></article><article className="kpi-card"><span>Active personnel</span><strong>{records.filter((item) => item.is_active).length}</strong></article><article className="kpi-card"><span>Inactive / suspended</span><strong>{records.filter((item) => !item.is_active).length}</strong></article><article className="kpi-card"><span>Configured roles</span><strong>{new Set(records.map((item) => item.role)).size}</strong></article></section>
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input placeholder="Search name, email, role or department…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></section>
    <section className="panel data-panel"><DataTable columns={columns} rows={filtered} emptyTitle="No users match this search" /></section>
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create user account" description="Assign the minimum role and organization scope required for the user's responsibility." footer={<><button className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-button" disabled={submitting} onClick={createUser}>{submitting ? "Creating…" : "Create account"}</button></>}>
      <div className="form-grid"><label className="form-field"><span>Full name *</span><input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label><label className="form-field"><span>Official email *</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="form-field"><span>Temporary password *</span><input type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label className="form-field"><span>Role *</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{ALL_ROLES.map((role) => <option key={role} value={role}>{roleConfig(role).label}</option>)}</select></label><label className="form-field"><span>Department</span><input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label><label className="form-field"><span>Faculty / organization</span><input value={form.faculty} onChange={(event) => setForm({ ...form, faculty: event.target.value })} /></label></div>
    </Modal>
  </>;
}
