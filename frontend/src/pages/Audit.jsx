import { Download, Search, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { api } from "../lib/api";
import { formatDateTime, humanize } from "../lib/format";

export default function Audit() {
  const [records, setRecords] = useState(null);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => { setError(""); api("/audit").then(setRecords).catch((requestError) => setError(requestError.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => (records || []).filter((item) => {
    const matchesSearch = !search || [item.actor, item.action, item.reference, item.details].some((value) => String(value).toLowerCase().includes(search.toLowerCase()));
    return matchesSearch && (!severity || item.severity === severity);
  }), [records, search, severity]);
  const columns = useMemo(() => [
    { key: "timestamp", label: "Timestamp", render: (item) => formatDateTime(item.timestamp) },
    { key: "actor", label: "Actor", render: (item) => <div className="stacked-cell"><strong>{item.actor}</strong><span>{item.actor_role}</span></div> },
    { key: "action", label: "Action", render: (item) => humanize(item.action) },
    { key: "record_type", label: "Record", render: (item) => <div className="stacked-cell"><strong>{item.record_type}</strong><span>{item.reference}</span></div> },
    { key: "details", label: "Details" },
    { key: "ip_address", label: "IP address" },
    { key: "severity", label: "Severity", render: (item) => <StatusBadge tone={item.severity === "warning" ? "orange" : item.severity === "critical" ? "red" : "blue"}>{item.severity}</StatusBadge> }
  ], []);
  if (error) return <><PageHeader eyebrow="Security and compliance" title="System audit log" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading immutable audit history" />;
  return <>
    <PageHeader eyebrow="Security and compliance" title="System audit log" description="Read-only history of authentication, configuration, workflow, document and reporting events." actions={<button className="secondary-button" onClick={() => window.print()}><Download size={17} /> Export view</button>} meta={<span className="scope-note"><ShieldCheck size={15} /> Read-only</span>} />
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input placeholder="Search actor, action, record or details…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">All severity levels</option><option value="info">Information</option><option value="warning">Warning</option><option value="critical">Critical</option></select></section>
    <section className="panel data-panel"><DataTable columns={columns} rows={filtered} emptyTitle="No audit events match this view" /></section>
  </>;
}
