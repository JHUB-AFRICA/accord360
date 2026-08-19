import { AlertTriangle, CheckCircle2, Clock3, LockKeyhole, MailCheck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const states = {
  "verify-email": { icon: MailCheck, eyebrow: "Email verification", title: "Verify your official email address", text: "Open the secure verification link sent to your registered email. The verification token expires after the configured security period.", tone: "blue", action: "Return to sign in" },
  "pending-review": { icon: Clock3, eyebrow: "Account pending review", title: "Your registration is being reviewed", text: "The Directorate of Linkages is validating the institution and supporting documents. You will be notified when access is approved or additional information is needed.", tone: "orange", action: "Return to sign in" },
  "suspended": { icon: LockKeyhole, eyebrow: "Account unavailable", title: "This account is suspended", text: "Contact the Directorate or system administrator for assistance. No records can be accessed while the account is suspended.", tone: "red", action: "Return to sign in" },
  "access-denied": { icon: AlertTriangle, eyebrow: "Access denied", title: "You do not have permission to open this workspace", text: "The requested page is outside your assigned role. Accord360 has not changed your current record or permissions.", tone: "red", action: "Return to my workspace" },
  "password-reset-success": { icon: CheckCircle2, eyebrow: "Password updated", title: "Your password was reset successfully", text: "Sign in using the new password. Other active sessions may be revoked according to the security policy.", tone: "green", action: "Continue to sign in" }
};

export default function AccountState({ type }) {
  const location = useLocation();
  const state = states[type] || states["access-denied"];
  const Icon = state.icon;
  const destination = location.state?.home || "/login";
  return <div className="standalone-state-page"><div className={`standalone-state-card ${state.tone}`}><Icon size={42} /><span className="section-kicker">{state.eyebrow}</span><h1>{state.title}</h1><p>{state.text}</p><div className="state-actions"><Link className="primary-button" to={destination}>{state.action}</Link><Link className="secondary-button" to="/login">Contact support</Link></div></div></div>;
}
