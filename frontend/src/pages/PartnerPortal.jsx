import { Building2, LockKeyhole, ShieldCheck } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

export default function PartnerPortal() {
  return <>
    <PageHeader eyebrow="Future external-partner workspace" title="Partner portal integration pending" description="The backend now accepts public partner applications and structured correction responses, but partner login and partner self-service access are still pending." meta={<StatusBadge tone="orange">Partner accounts pending</StatusBadge>} />
    <section className="panel empty-state"><span className="empty-icon"><Building2 /></span><h2>No arbitrary partner API calls</h2><p>This frontend intentionally does not call partner-account endpoints. Public registration and correction-response endpoints are implemented, while partner identity, authentication and record-scoped self-service access remain future work.</p><div className="guidance-grid"><article><LockKeyhole /><div><strong>Required backend capability</strong><span>Partner identity, authentication and record-scoped access.</span></div></article><article><ShieldCheck /><div><strong>Security requirement</strong><span>Partner-visible agreements and documents must be filtered by the backend, not only by frontend route guards.</span></div></article></div></section>
  </>;
}
