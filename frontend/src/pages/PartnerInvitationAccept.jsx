import { Building2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import FormField from "../components/FormField.jsx";
import Toast from "../components/Toast.jsx";
import { acceptPartnerInvitation } from "../lib/backend.js";

export default function PartnerInvitationAccept() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function accept(event) {
    event.preventDefault();
    setSubmitting(true);
    try { await acceptPartnerInvitation(params.get("token") || "", password); navigate("/login", { state: { message: "Partner account created. Sign in to open your workspace." } }); }
    catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }

  return <div className="standalone-state-page"><Toast message={error} type="error" onClose={() => setError("")} /><div className="standalone-state-card"><Building2 size={42} /><span className="section-kicker">Partner invitation</span><h1>Activate your partner workspace</h1><p>Create the password for your organization account. Access is limited to agreements and documents shared with your organization.</p><form onSubmit={accept}><FormField label="Password" required><input type="password" minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} /></FormField><button className="primary-button" disabled={submitting || !params.get("token")} type="submit">{submitting ? "Activating…" : "Activate account"}</button></form><p className="form-help"><CheckCircle2 size={15} /> Invitation links expire and can only be used once.</p><Link to="/login" className="text-link">Return to sign in</Link></div></div>;
}
