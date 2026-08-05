import { ArrowLeft, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setAcknowledged(true);
  }

  return <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo"><span>360</span><div><strong>ACCORD360</strong><small>JKUAT PARTNERSHIPS</small></div></div>
        <div className="auth-icon"><LockKeyhole /></div>
        <h1>Password assistance</h1>
        <p>The current backend does not expose a password-reset endpoint. This screen records no request and does not call an arbitrary URL.</p>
        {acknowledged ? <div className="inline-alert info"><ShieldCheck size={18} /><div><strong>Contact the system administrator</strong><p>Ask an authorized administrator to assist with account access for <b>{email || "your official email"}</b>.</p></div></div> : <form onSubmit={handleSubmit} className="auth-form"><label><span>Registered email address</span><div className="input-with-icon"><Mail size={18} /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@jkuat.ac.ke" /></div></label><button className="primary-button full-width" type="submit">Show recovery guidance</button></form>}
        <Link className="back-link" to="/login"><ArrowLeft size={16} /> Back to sign in</Link>
      </section>
  </main>;
}
