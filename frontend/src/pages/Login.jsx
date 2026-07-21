import { useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@accord360.app");
  const [password, setPassword] = useState("Admin@123");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-grid" />
        <div className="visual-content">
          <div className="visual-brand"><span>A</span> Accord 360</div>
          <div className="visual-copy">
            <div className="eyebrow eyebrow-light">JKUAT Directorate of Linkages</div>
            <h1>Partnership governance, from first request to measurable impact.</h1>
            <p>A secure workspace for MoU, CRA and CA workflow, legal review, signing, M&E, alerts and executive intelligence.</p>
            <div className="visual-points">
              <span><CheckCircle2 size={18} /> Controlled workflow and SLA tracking</span>
              <span><CheckCircle2 size={18} /> Auditable documents and approvals</span>
              <span><CheckCircle2 size={18} /> Real-time partnership performance</span>
            </div>
          </div>
          <div className="visual-footer">Prepared for JKUAT Linkages · Built by JHUB Africa</div>
        </div>
      </section>
      <section className="login-form-side">
        <form className="login-card" onSubmit={submit}>
          <div className="login-logo"><ShieldCheck size={25} /></div>
          <div className="eyebrow">Secure institutional access</div>
          <h2>Welcome back</h2>
          <p>Sign in to your Accord 360 workspace.</p>
          {error && <div className="form-error">{error}</div>}
          <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Password
            <div className="password-input">
              <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </label>
          <button className="primary-button full-button" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}<ArrowRight size={18} />
          </button>
          <div className="demo-credentials">
            <LockKeyhole size={18} />
            <div><strong>Demo administrator</strong><span>admin@accord360.app · Admin@123</span></div>
          </div>
        </form>
      </section>
    </div>
  );
}
