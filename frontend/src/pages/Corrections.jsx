import { AlertTriangle, ArrowRight, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { listCorrections } from "../lib/backend.js";
import { formatDateTime, humanize } from "../lib/format.js";

export default function Corrections() {
  const [records, setRecords] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError("");
    try {
      setRecords(await listCorrections());
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (records || []).filter((item) => {
    const query = search.trim().toLowerCase();
    return !query || [item.agreement_reference, item.agreement_title, item.partner_name, item.requested_change, item.status]
      .some((value) => String(value || "").toLowerCase().includes(query));
  }), [records, search]);

  const columns = useMemo(() => [
    { key: "agreement_reference", label: "Agreement", render: (item) => <div className="stacked-cell"><strong>{item.agreement_reference}</strong><span>{item.agreement_title}</span></div> },
    { key: "partner_name", label: "Partner" },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status}>{humanize(item.status)}</StatusBadge> },
    { key: "requested_by", label: "Requested by", render: (item) => <div className="stacked-cell"><strong>{item.requested_by?.full_name || "Authorized reviewer"}</strong><span>{formatDateTime(item.created_at)}</span></div> },
    { key: "reason", label: "Correction reason", render: (item) => <span className="wrap-cell">{item.requested_change}</span> },
    { key: "action", label: "Action", render: (item) => <Link className="text-link" to={`/corrections/${item.id}`}>Open correction <ArrowRight size={15} /></Link> }
  ], []);

  if (error && !records) return <><PageHeader eyebrow="Correction traceability" title="Returned agreements" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading returned agreements" />;

  return <>
    <PageHeader eyebrow="Correction traceability" title="Correction register" meta={<span className="scope-note"><AlertTriangle size={15} /> {records.filter((item) => item.status !== "resolved").length} open correction{records.filter((item) => item.status !== "resolved").length === 1 ? "" : "s"}</span>} />
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input aria-label="Search returned agreements" placeholder="Search reference, partner or correction reason…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></section>
    <section className="panel data-panel"><DataTable columns={columns} rows={filtered} onRowClick={(item) => navigate(`/corrections/${item.id}`)} emptyTitle="No corrections recorded" emptyText="Structured correction records within your backend-authorized scope will appear here." /></section>
  </>;
}
