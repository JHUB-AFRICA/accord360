import { Plus, Search, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { createUser as createUserRequest, listUsers, updateUser } from "../lib/backend.js";
import { formatDate, humanize } from "../lib/format.js";
import { ALL_ROLES, roleConfig } from "../lib/roles.js";

const emptyForm = { full_name: "", email: "", password: "", role: "researcher", department: "" };

export default function Users() {
  const [records, setRecords] = useState(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try { setRecords(await listUsers()); }
    catch (requestError) { setError(requestError.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (records || []).filter((item) => {
    const query = search.trim().toLowerCase();
    return !query || [item.full_name, item.email, item.role, item.department]
      .some((value) => String(value || "").toLowerCase().includes(query));
  }), [records, search]);

  async function submitUser() {
    if (form.full_name.trim().length < 2 || !form.email.trim() || form.password.length < 8) {
      setError("Full name, official email and a password of at least 8 characters are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const created = await createUserRequest({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        department: form.department.trim() || null
      });
      setRecords((current) => [...current, created].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setForm(emptyForm);
      setShowCreate(false);
      setMessage("User account created.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }

  async function toggleActive(item) {
    setError("");
    try {
      const updated = await updateUser(item.id, { is_active: !item.is_active });
      setRecords((current) => current.map((record) => record.id === updated.id ? updated : record));
      setMessage(`${updated.full_name} is now ${updated.is_active ? "active" : "inactive"}.`);
    } catch (requestError) { setError(requestError.message); }
  }

  const columns = useMemo(() => [
    { key: "full_name", label: "User", render: (item) => <div className="stacked-cell"><strong>{item.full_name}</strong><span>{item.email}</span></div> },
    { key: "role", label: "Role", render: (item) => <StatusBadge tone="blue">{roleConfig(item.role).label}</StatusBadge> },
    { key: "department", label: "Department", render: (item) => item.department || "Not assigned" },
    { key: "is_active", label: "Status", render: (item) => <StatusBadge tone={item.is_active ? "green" : "slate"}>{item.is_active ? "Active" : "Inactive"}</StatusBadge> },
    { key: "created_at", label: "Created", render: (item) => formatDate(item.created_at) },
    { key: "action", label: "Access action", render: (item) => <button className="text-button" type="button" onClick={(event) => { event.stopPropagation(); toggleActive(item); }}>{item.is_active ? <UserX size={16} /> : <UserCheck size={16} />}{item.is_active ? "Deactivate" : "Activate"}</button> }
  ], []);

  if (error && !records) return <><PageHeader eyebrow="Role-based access control" title="Users and roles" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading users and roles" />;

  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Role-based access control" title="Users and roles" description="Uses the implemented GET/POST/PATCH /users routes. IDs are backend integers and only the documented role values are submitted." actions={<button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} /> Add user</button>} meta={<span className="scope-note"><ShieldCheck size={15} /> Administrator only</span>} />
    <section className="kpi-grid compact-kpis"><article className="kpi-card"><span>Total users</span><strong>{records.length}</strong></article><article className="kpi-card"><span>Active personnel</span><strong>{records.filter((item) => item.is_active).length}</strong></article><article className="kpi-card"><span>Inactive / suspended</span><strong>{records.filter((item) => !item.is_active).length}</strong></article><article className="kpi-card"><span>Configured roles</span><strong>{new Set(records.map((item) => item.role)).size}</strong></article></section>
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input aria-label="Search users" placeholder="Search name, email, role or department…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></section>
    <section className="panel data-panel"><DataTable columns={columns} rows={filtered} emptyTitle="No users match this search" /></section>
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create user account" description="Assign the minimum backend role and department required for the user's responsibility." footer={<><button className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-button" disabled={submitting} onClick={submitUser}>{submitting ? "Creating…" : "Create account"}</button></>}>
      <div className="form-grid"><label className="form-field"><span>Full name *</span><input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label><label className="form-field"><span>Official email *</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="form-field"><span>Temporary password *</span><input type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label className="form-field"><span>Role *</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{ALL_ROLES.map((role) => <option key={role} value={role}>{roleConfig(role).label} ({humanize(role)})</option>)}</select></label><label className="form-field"><span>Department</span><input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label></div>
    </Modal>
  </>;
}
