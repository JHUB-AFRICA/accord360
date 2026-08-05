import { Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="standalone-state-page">
    <form className="standalone-state-card" onSubmit={submit}>
      <Mail size={38} />
      <span className="section-kicker">Account recovery</span>
      <h1>Reset your password</h1>
      <p>Enter the email registered with your JKUAT or partner account. For privacy, the confirmation does not reveal whether an account exists.</p>
      {error && <div className="form-alert error">{error}</div>}
      {sent
        ? <div className="form-alert success">When an active account exists for <strong>{email}</strong>, the account service will send a secure reset link.</div>
        : <label className="auth-field"><span>Registered email address</span><div><Mail size={18} /><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div></label>}
      <div className="state-actions">
        {!sent && <button className="primary-button" disabled={submitting}>{submitting ? "Submitting…" : "Send secure reset link"}</button>}
        <Link className="secondary-button" to="/login">Back to sign in</Link>
      </div>
    </form>
  </div>;
}
