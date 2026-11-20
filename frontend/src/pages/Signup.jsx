import { Building2, Eye, EyeOff, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAuthConfig } from "../lib/backend.js";
import { roleHome } from "../lib/roles";

const OFFICES = [
  { value: "researcher", label: "Researcher (JKUAT champion)" },
  { value: "linkages", label: "Linkages office" },
  { value: "legal", label: "Legal office" },
  { value: "me", label: "M&E office" }
];

export default function Signup() {
  const { user, signup } = useAuth();
  const [enabled, setEnabled] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", role: "researcher", department: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    getAuthConfig().then((config) => active && setEnabled(Boolean(config?.demo_signup_enabled))).catch(() => active && setEnabled(false));
    return () => { active = false; };
  }, []);

  if (user) return <Navigate to={roleHome(user.role)} replace />;
  if (enabled === false) return <Navigate to="/login" replace />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.role === "researcher" && !form.department.trim()) return setError("Please enter your department.");
    setSubmitting(true);
    try {
      const created = await signup({ ...form, email: form.email.trim(), department: form.department.trim() });
      navigate(roleHome(created.role), { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to create the account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand-panel"><Link className="public-brand auth-brand" to="/"><span className="brand-mark">A</span><span><strong>Accord360</strong><small>Directorate of Linkages (RPE)</small></span></Link><div><span className="hero-kicker">Demo access</span><h1>Join Accord360 in a few seconds.</h1><p>Give us your email and the office you work for. Use the email you open Google Docs with — drafting documents are shared with it.</p></div></div>
      <main className="auth-form-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-card-head"><span className="auth-logo"><UserPlus /></span><h2>Create your account</h2><p>No email verification needed.</p></div>
          {error && <div className="form-alert error" role="alert">{error}</div>}
          <label className="auth-field"><span>Email address</span><div><Mail size={18} /><input type="email" autoComplete="username" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@gmail.com" /></div></label>
          <label className="auth-field"><span>Office you work for</span><div><Building2 size={18} /><select required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{OFFICES.map((office) => <option value={office.value} key={office.value}>{office.label}</option>)}</select></div></label>
          {form.role === "researcher" && <label className="auth-field"><span>Your department</span><div><Building2 size={18} /><input required value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="e.g. Computing" /></div><small>Used to fill in your agreements.</small></label>}
          <label className="auth-field"><span>Password (to sign back in later)</span><div><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          <button className="primary-button auth-submit" disabled={submitting}>{submitting ? <span className="button-spinner" /> : "Create account and continue"}</button>
          <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
        </form>
      </main>
    </div>
  );
}
