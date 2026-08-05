import { Download, Search, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { listAudit } from "../lib/backend.js";
import { formatDateTime, humanize } from "../lib/format.js";

function eventTone(action = "") {
  const value = action.toLowerCase();
  if (value.includes("reject") || value.includes("delete") || value.includes("deactivate")) return "red";
  if (value.includes("return") || value.includes("close")) return "orange";
  if (value.includes("approve") || value.includes("activate") || value.includes("create")) return "green";
  return "blue";
}

export default function Audit() {
  const [records, setRecords] = useState(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [limit, setLimit] = useState(100);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setRecords(await listAudit(limit));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  const actionOptions = useMemo(
    () => [...new Set((records || []).map((item) => item.action).filter(Boolean))].sort(),
    [records]
  );

  const filtered = useMemo(() => (records || []).filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      item.actor_name,
      item.actor_role,
      item.action,
      item.record_type,
      item.reference,
      item.details,
      item.ip_address
    ].some((value) => String(value || "").toLowerCase().includes(query));
    return matchesSearch && (!action || item.action === action);
  }), [records, search, action]);

  const columns = useMemo(() => [
    { key: "timestamp", label: "Timestamp", render: (item) => formatDateTime(item.timestamp) },
    { key: "actor_name", label: "Actor", render: (item) => <div className="stacked-cell"><strong>{item.actor_name}</strong><span>{humanize(item.actor_role)}</span></div> },
    { key: "action", label: "Action", render: (item) => <StatusBadge tone={eventTone(item.action)}>{humanize(item.action)}</StatusBadge> },
    { key: "record_type", label: "Record", render: (item) => <div className="stacked-cell"><strong>{humanize(item.record_type)}</strong><span>{item.reference}</span></div> },
    { key: "details", label: "Change details", render: (item) => <span className="wrap-cell">{item.details || "No serialized change details"}</span> },
    { key: "ip_address", label: "Source IP" }
  ], []);

  if (error && !records) return <><PageHeader eyebrow="Security and compliance" title="System audit log" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading authorized audit history" />;

  return <>
    <PageHeader
      eyebrow="Security and compliance"
      title="System audit log"
      description="Read-only audit events returned by GET /reports/audit. The backend controls role access and the maximum result limit."
      actions={<button className="secondary-button" onClick={() => window.print()}><Download size={17} /> Print current view</button>}
      meta={<span className="scope-note"><ShieldCheck size={15} /> Backend-authorized, read-only</span>}
    />
    {error && <div className="inline-alert error">{error}</div>}
    <section className="panel filter-panel">
      <div className="search-field"><Search size={18} /><input aria-label="Search audit events" placeholder="Search actor, action, record or details…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <select aria-label="Filter audit action" value={action} onChange={(event) => setAction(event.target.value)}><option value="">All actions</option>{actionOptions.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select>
      <select aria-label="Audit result limit" value={limit} onChange={(event) => setLimit(Number(event.target.value))}><option value={50}>Latest 50</option><option value={100}>Latest 100</option><option value={250}>Latest 250</option><option value={500}>Latest 500</option></select>
    </section>
    <section className="panel data-panel"><DataTable columns={columns} rows={filtered} emptyTitle="No audit events match this view" /></section>
  </>;
}
