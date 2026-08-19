import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { DEMO_ACCOUNTS } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../lib/roles";

export default function Login() {
  const { user, login, sessionMessage, clearSessionMessage, isMockMode } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => () => clearSessionMessage(), [clearSessionMessage]);
  if (user) return <Navigate to={roleHome(user.role)} replace />;

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const signedIn = await login(form.email.trim(), form.password);
      navigate(location.state?.from || roleHome(signedIn.role), { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  function chooseAccount(account) {
    setForm({ email: account.email, password: account.password });
    setError("");
  }

  return (
    <div className="auth-page">
      <div className="auth-brand-panel"><Link className="public-brand auth-brand" to="/"><span className="brand-mark">A</span><span><strong>Accord360</strong><small>Directorate of Linkages (RPE)</small></span></Link><div><span className="hero-kicker">JKUAT partnership portal</span><h1>Secure access to every stage of the partnership lifecycle.</h1><p>Each user is routed to a workspace designed for their institutional responsibility.</p></div><ul><li><ShieldCheck /> Role-specific navigation and actions</li><li><LockKeyhole /> Audited approval gates</li><li><Mail /> Action-linked notifications</li></ul></div>
      <main className="auth-form-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="auth-card-head"><span className="auth-logo"><LockKeyhole /></span><h2>Sign in to Accord360</h2><p>Use your approved JKUAT institutional account.</p></div>
          {sessionMessage && <div className="form-alert warning">{sessionMessage}</div>}
          {error && <div className="form-alert error" role="alert">{error}</div>}
          <label className="auth-field"><span>Official email address</span><div><Mail size={18} /><input type="email" autoComplete="username" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@institution.ac.ke" /></div></label>
          <label className="auth-field"><span>Password</span><div><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Enter password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          <div className="auth-options"><label><input type="checkbox" /> Keep me signed in</label><Link to="/forgot-password">Forgot password?</Link></div>
          <button className="primary-button auth-submit" disabled={submitting}>{submitting ? <span className="button-spinner" /> : "Sign in to workspace"}</button>
          <p className="auth-register">External collaborating institution? <Link to="/partner/register">Review the proposed registration form</Link></p>

          {isMockMode && <div className="demo-account-box"><div><strong>Demonstration accounts</strong><span>Select a role to fill its test credentials.</span></div><select aria-label="Select demonstration account" defaultValue="" onChange={(event) => { const selected = DEMO_ACCOUNTS.find((account) => account.email === event.target.value); if (selected) chooseAccount(selected); }}><option value="" disabled>Choose a role…</option>{DEMO_ACCOUNTS.map((account) => <option value={account.email} key={account.email}>{account.label}</option>)}</select><small>Demo mode is explicitly enabled through VITE_USE_MOCK_API. It is never used after a failed sign-in attempt.</small></div>}
        </form>
      </main>
    </div>
  );
}
