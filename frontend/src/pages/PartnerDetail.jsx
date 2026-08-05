import { ArrowLeft, Building2, ExternalLink, FileText, Mail, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { stageLabel } from "../lib/workflow";

export default function PartnerDetail() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => { setError(""); api(`/partners/${id}`).then(setRecord).catch((requestError) => setError(requestError.message)); }, [id]);
  useEffect(() => { load(); }, [load]);
  if (error) return <><PageHeader eyebrow="Partner profile" title="Unable to load partner" /><ErrorState message={error} onRetry={load} /></>;
  if (!record) return <LoadingState label="Loading partner profile" />;
  const agreementColumns = [
    { key: "reference", label: "Reference", render: (item) => <Link className="text-link" to={`/agreements/${item.id}`}>{item.reference}</Link> },
    { key: "title", label: "Agreement" },
    { key: "agreement_type", label: "Type", render: (item) => <StatusBadge tone="blue">{item.agreement_type}</StatusBadge> },
    { key: "stage", label: "Stage", render: (item) => stageLabel(item.stage) },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> }
  ];
  return <>
    <PageHeader eyebrow="Partner profile" title={record.name} description={`${record.institution_type} · ${record.country}`} actions={<><Link className="secondary-button" to="/partners"><ArrowLeft size={17} /> Partner registry</Link>{record.verification_status !== "verified" && <Link className="primary-button" to={`/partners/${record.id}/verify`}>Open verification</Link>}</>} meta={<div className="header-badges"><StatusBadge status={record.verification_status} /><StatusBadge status={record.risk} risk /></div>} />
    <div className="detail-grid">
      <section className="panel detail-main-card"><div className="partner-profile-head"><span className="large-partner-icon"><Building2 /></span><div><h2>Institution overview</h2><p>{record.notes}</p></div></div><div className="contact-grid"><article><MapPin /><div><span>Country and region</span><strong>{record.country}, {record.region}</strong></div></article><article><ExternalLink /><div><span>Official website</span><a href={record.website} target="_blank" rel="noreferrer">{record.website}</a></div></article><article><ShieldCheck /><div><span>Registration number</span><strong>{record.registration_number}</strong></div></article><article><Building2 /><div><span>Sector</span><strong>{record.sector}</strong></div></article></div><hr /><h3>Primary contact</h3><div className="contact-grid"><article><UserRound /><div><span>Contact person</span><strong>{record.contact_name}</strong></div></article><article><Mail /><div><span>Email</span><strong>{record.contact_email}</strong></div></article><article><Phone /><div><span>Phone</span><strong>{record.contact_phone}</strong></div></article><article><UserRound /><div><span>Assigned Champion</span><strong>{record.champion_name || "Not assigned"}</strong></div></article></div></section>
      <aside className="panel detail-side-card"><h2>Verification summary</h2><div className="readiness-list"><span className={record.website ? "done" : ""}><ShieldCheck /> Official website recorded</span><span className={record.registration_number ? "done" : ""}><ShieldCheck /> Registration evidence recorded</span><span className={record.documents?.length ? "done" : ""}><ShieldCheck /> Supporting documents available</span><span className={record.champion_id ? "done" : ""}><ShieldCheck /> Champion assigned</span></div><hr /><h3>Portfolio</h3><dl className="aside-summary"><div><dt>Active collaborations</dt><dd>{record.active_collaborations}</dd></div><div><dt>Verification status</dt><dd>{record.verification_status.replaceAll("_", " ")}</dd></div><div><dt>Risk</dt><dd>{record.risk}</dd></div></dl></aside>
    </div>
    <section className="panel data-panel"><div className="panel-head"><div><h2>Agreement history</h2><p>All collaboration records linked to this partner profile</p></div></div><DataTable columns={agreementColumns} rows={record.agreements || []} emptyTitle="No agreements linked to this partner" /></section>
    <section className="panel data-panel"><div className="panel-head"><div><h2>Verification documents</h2><p>Registration, accreditation and legitimacy evidence</p></div></div><div className="document-list">{(record.documents || []).map((document) => <article className="document-row" key={document.id}><span className="document-icon"><FileText /></span><div><strong>{document.name}</strong><span>{document.type} · Version {document.version}</span><small>Uploaded {formatDate(document.uploaded_at)} by {document.uploaded_by}</small></div><StatusBadge status={document.status} /></article>)}</div></section>
  </>;
}
