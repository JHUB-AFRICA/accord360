import { Building2, LockKeyhole, ShieldCheck } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

export default function PartnerPortal() {
  return <>
    <PageHeader eyebrow="Future external-partner workspace" title="Partner portal integration pending" description="The current backend role list contains internal JKUAT roles only and does not expose partner authentication or partner self-service endpoints." meta={<StatusBadge tone="orange">Backend pending</StatusBadge>} />
    <section className="panel empty-state"><span className="empty-icon"><Building2 /></span><h2>No arbitrary partner API calls</h2><p>This frontend intentionally does not call GET /partners/:id, PATCH /partners/:id, public registration, correction-response or partner-account endpoints because they are not in the implemented API contract.</p><div className="guidance-grid"><article><LockKeyhole /><div><strong>Required backend capability</strong><span>Partner identity, authentication and record-scoped access.</span></div></article><article><ShieldCheck /><div><strong>Security requirement</strong><span>Partner-visible agreements and documents must be filtered by the backend, not only by frontend route guards.</span></div></article></div></section>
  </>;
}
