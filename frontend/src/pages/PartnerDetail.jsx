import { ArrowLeft, Building2, Mail, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getPartner, listAgreements } from "../lib/backend.js";
import { stageLabel } from "../lib/workflow.js";

export default function PartnerDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const canVerify = ["linkages", "director_linkages"].includes(user.role);

  const load = useCallback(() => {
    setError("");
    Promise.all([getPartner(id), listAgreements()])
      .then(([partner, agreementList]) => {
        if (!partner) throw new Error("Partner not found.");
        setRecord(partner);
        setAgreements(agreementList.filter((agreement) => Number(agreement.partner_id) === Number(id)));
      })
      .catch((requestError) => setError(requestError.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const agreementColumns = useMemo(() => [
    { key: "reference", label: "Reference", render: (item) => <Link className="text-link" to={`/agreements/${item.id}`}>{item.reference}</Link> },
    { key: "title", label: "Agreement" },
    { key: "agreement_type", label: "Type", render: (item) => <StatusBadge tone="blue">{item.agreement_type}</StatusBadge> },
    { key: "stage", label: "Stage", render: (item) => stageLabel(item.stage) },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> }
  ], []);

  if (error) return <><PageHeader eyebrow="Partner profile" title="Unable to load partner" /><ErrorState message={error} onRetry={load} /></>;
  if (!record) return <LoadingState label="Loading partner profile" />;

  return <>
    <PageHeader eyebrow="Partner profile" title={record.name} description={`${record.partner_type} · ${record.country}`} actions={<><button className="secondary-button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Back</button>{canVerify && <Link className="primary-button" to={`/partners/${record.id}/verify`}>Review status</Link>}</>} meta={<StatusBadge status={record.status} />} />
    <div className="detail-grid">
      <section className="panel detail-main-card"><div className="partner-profile-head"><span className="large-partner-icon"><Building2 /></span><div><h2>Institution overview</h2><p>Partner fields returned by PartnerOut.</p></div></div><div className="contact-grid"><article><MapPin /><div><span>Country</span><strong>{record.country}</strong></div></article><article><Building2 /><div><span>Sector</span><strong>{record.sector}</strong></div></article><article><Building2 /><div><span>Partner type</span><strong>{record.partner_type}</strong></div></article><article><ShieldCheck /><div><span>Status</span><strong>{record.status}</strong></div></article></div><hr /><h3>Primary contact</h3><div className="contact-grid"><article><UserRound /><div><span>Contact person</span><strong>{record.contact_name || "Not recorded"}</strong></div></article><article><Mail /><div><span>Email</span><strong>{record.contact_email || "Not recorded"}</strong></div></article><article><UserRound /><div><span>Legal counterpart</span><strong>{record.legal_counterpart || "Not recorded"}</strong></div></article><article><UserRound /><div><span>Partner liaison</span><strong>{record.liaison || "Not recorded"}</strong></div></article></div></section>
      <aside className="panel detail-side-card"><h2>Backend scope</h2><div className="readiness-list"><span className="done"><ShieldCheck /> Partner identity stored</span><span className={record.contact_email ? "done" : ""}><ShieldCheck /> Contact email recorded</span><span className={record.legal_counterpart ? "done" : ""}><ShieldCheck /> Legal counterpart recorded</span><span className={record.liaison ? "done" : ""}><ShieldCheck /> Liaison recorded</span></div><hr /><h3>Portfolio</h3><dl className="aside-summary"><div><dt>Visible agreements</dt><dd>{agreements.length}</dd></div><div><dt>Status</dt><dd>{record.status}</dd></div></dl></aside>
    </div>
    <section className="panel data-panel"><div className="panel-head"><div><h2>Agreement history</h2><p>Role-scoped agreements linked to this partner</p></div></div><DataTable columns={agreementColumns} rows={agreements} emptyTitle="No visible agreements linked to this partner" /></section>
  </>;
}
