import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return <div className="standalone-state-page"><div className="standalone-state-card"><Compass size={42} /><span className="section-kicker">Page not found</span><h1>This Accord360 page does not exist.</h1><p>Check the address or return to your role-specific workspace.</p><div className="state-actions"><Link className="primary-button" to="/">Return to workspace</Link><Link className="secondary-button" to="/help">Open help</Link></div></div></div>;
}
