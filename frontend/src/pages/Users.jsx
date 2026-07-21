import { useEffect, useState } from "react";
import { Plus, UserCog } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Toast from "../components/Toast";
import { api } from "../lib/api";

const roles = ["admin", "researcher", "approver", "linkages", "legal", "executive", "me", "auditor"];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "researcher", department: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function load() { setUsers(await api("/users")); }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);
  async function create(event) { event.preventDefault(); try { await api("/users", { method: "POST", body: JSON.stringify(form) }); setMessage("User created."); setShow(false); setForm({ full_name: "", email: "", password: "", role: "researcher", department: "" }); await load(); } catch (err) { setError(err.message); } }
  async function changeRole(user, role) { try { await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ role }) }); setMessage("Role updated."); await load(); } catch (err) { setError(err.message); } }
  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader eyebrow="Role-based access control" title="Users and roles" description="Provision users, assign institutional responsibilities and maintain least-privilege access." actions={<button className="primary-button" onClick={() => setShow(!show)}><Plus size={18} /> New user</button>} />
      {show && <form className="panel form-section" onSubmit={create}><div className="form-grid form-grid-3"><label>Full name<input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label><label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Temporary password<input type="password" minLength="8" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label><label>Department<input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label></div><button className="primary-button"><Plus size={17} /> Create account</button></form>}
      <div className="panel"><div className="table-wrap"><table><thead><tr><th>User</th><th>Department</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td data-label="User"><div className="user-cell"><div className="avatar avatar-small"><UserCog size={16} /></div><div><strong>{user.full_name}</strong><span>{user.email}</span></div></div></td><td data-label="Department">{user.department || "—"}</td><td data-label="Role"><select className="role-select" value={user.role} onChange={(e) => changeRole(user, e.target.value)}>{roles.map((role) => <option key={role}>{role}</option>)}</select></td><td data-label="Status"><span className={`partner-status ${user.is_active ? "active" : "inactive"}`}>{user.is_active ? "active" : "inactive"}</span></td><td data-label="Created">{new Date(user.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></div>
    </>
  );
}
