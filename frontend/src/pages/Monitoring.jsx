import { Activity, AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Gauge, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import KpiCard from "../components/KpiCard.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { listAgreements } from "../lib/backend.js";
import { formatDate, humanize } from "../lib/format.js";

export default function Monitoring({ view = "workspace" }) {
  const [records, setRecords] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError("");
    try {
      const [active, renewal] = await Promise.all([
        listAgreements({ stage: "active" }),
        listAgreements({ stage: "renewal_closure" })
      ]);
      const unique = new Map([...active, ...renewal].map((item) => [item.id, item]));
      setRecords([...unique.values()]);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (records || []).filter((item) => {
    const query = search.trim().toLowerCase();
    return !query || [item.reference, item.title, item.partner_name, item.department, item.status]
      .some((value) => String(value || "").toLowerCase().includes(query));
  }), [records, search]);

  const columns = useMemo(() => [
    { key: "reference", label: "Agreement", render: (item) => <div className="stacked-cell"><strong>{item.reference}</strong><span>{item.title}</span></div> },
    { key: "partner_name", label: "Partner" },
    { key: "agreement_type", label: "Type", render: (item) => <StatusBadge tone="blue">{item.agreement_type}</StatusBadge> },
    { key: "expiry_date", label: "Expiry", render: (item) => formatDate(item.expiry_date) },
    { key: "status", label: "Portfolio status", render: (item) => <StatusBadge status={item.status}>{humanize(item.status)}</StatusBadge> },
    { key: "current_action", label: "Next action", render: (item) => <span className="wrap-cell">{item.current_action}</span> },
    { key: "action", label: "Action", render: (item) => <Link className="text-link" to={`/monitoring/reports/${item.id}`}>{view === "reports" ? "Open reporting form" : "Update M&E"} <ArrowRight size={15} /></Link> }
  ], [view]);

  if (error && !records) return <><PageHeader eyebrow="Monitoring & evaluation" title="Partnership performance" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading active partnership records" />;

  const atRisk = records.filter((item) => ["orange", "red"].includes(item.status_color)).length;
  const expiring = records.filter((item) => Number(item.days_to_expiry) <= 183).length;
  const activeCount = records.filter((item) => item.backend_stage === "active").length;

  return <>
    <PageHeader eyebrow="Monitoring & evaluation" title={view === "reports" ? "Six-month reporting workspace" : "Partnership performance workspace"} description="The implemented backend stores M&E information as agreement deliverables, evidence documents and value records. There is no separate report endpoint." actions={<Link className="secondary-button" to="/scorecards"><Gauge size={17} /> Open score previews</Link>} />
    <section className="kpi-grid"><KpiCard label="Active agreements" value={activeCount} tone="green" icon={Activity} /><KpiCard label="Requiring attention" value={atRisk} tone="orange" icon={AlertTriangle} /><KpiCard label="Expiring within 183 days" value={expiring} tone="red" icon={CalendarClock} /><KpiCard label="Backend-scoped records" value={records.length} tone="blue" icon={CheckCircle2} /></section>
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input aria-label="Search monitoring records" placeholder="Search reference, partner or department…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></section>
    <section className="panel data-panel"><DataTable columns={columns} rows={filtered} onRowClick={(item) => navigate(`/monitoring/reports/${item.id}`)} emptyTitle="No agreements available for monitoring" emptyText="Active or renewal-stage agreements within your backend-authorized scope will appear here." /></section>
  </>;
}
