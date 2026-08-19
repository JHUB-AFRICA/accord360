import { CheckCircle2, Clock3, MailCheck } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

export default function RegistrationSubmitted() {
  const [params] = useSearchParams();
  const location = useLocation();
  const reference = location.state?.reference || params.get("reference") || "Pending reference";
  return <div className="standalone-state-page"><div className="standalone-state-card success"><CheckCircle2 size={42} /><span className="section-kicker">Registration received</span><h1>Your institution has been submitted for review.</h1><p>The Directorate of Linkages (RPE) has been notified. Keep the reference below for future communication.</p><div className="reference-box"><span>Application reference</span><strong>{reference}</strong></div><div className="next-step-cards"><article><MailCheck /><div><strong>Email verification</strong><span>Confirm the official contact email when the verification link arrives.</span></div></article><article><Clock3 /><div><strong>Directorate review</strong><span>Accord360 will display the verification status and any additional information required.</span></div></article></div><div className="state-actions"><Link className="primary-button" to="/login">Sign in to portal</Link><Link className="secondary-button" to="/">Return to public portal</Link></div></div></div>;
}
