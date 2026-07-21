import { BellRing, Database, KeyRound, SlidersHorizontal } from "lucide-react";
import PageHeader from "../components/PageHeader";

export default function Settings() {
  return (
    <>
      <PageHeader eyebrow="Administration" title="System settings" description="Configuration placeholders for workflow rules, alerts, reference data and integration readiness." />
      <div className="settings-grid">
        {[ [SlidersHorizontal, "Workflow configuration", "Agreement types, routing stages, owners and exit criteria."], [BellRing, "SLA and alert rules", "Legal review threshold, expiry windows, dormancy and escalation recipients."], [Database, "Reference data", "Departments, sectors, strategic alignment and deliverable categories."], [KeyRound, "Security and integrations", "SSO, email, e-signature, backup and API configuration."] ].map(([Icon, title, text]) => <article className="panel settings-card" key={title}><div className="settings-icon"><Icon size={22} /></div><h3>{title}</h3><p>{text}</p><button className="secondary-button" disabled>Configure in next phase</button></article>)}
      </div>
    </>
  );
}
