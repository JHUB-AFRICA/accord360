import { AlertTriangle, ArrowRight, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { getAgreement, listAgreements } from "../lib/backend.js";
import { formatDateTime, humanize } from "../lib/format.js";

function latestReturnEvent(record) {
  return [...(record.workflow_events || [])].reverse().find((event) => ["return_correction", "return_dvc", "reject"].includes(event.action));
}

export default function Corrections() {
  const [records, setRecords] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError("");
    try {
      const agreements = await listAgreements();
      const returned = agreements.filter((item) => ["correction_required", "dvc_returned"].includes(item.status));
      const details = await Promise.all(returned.map((item) => getAgreement(item.id)));
      setRecords(details.map((item) => ({ ...item, return_event: latestReturnEvent(item) })));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (records || []).filter((item) => {
    const query = search.trim().toLowerCase();
    return !query || [item.reference, item.title, item.partner_name, item.return_event?.comment, item.status]
      .some((value) => String(value || "").toLowerCase().includes(query));
  }), [records, search]);

  const columns = useMemo(() => [
    { key: "reference", label: "Agreement", render: (item) => <div className="stacked-cell"><strong>{item.reference}</strong><span>{item.title}</span></div> },
    { key: "partner_name", label: "Partner" },
    { key: "status", label: "Return type", render: (item) => <StatusBadge status={item.status}>{humanize(item.status)}</StatusBadge> },
    { key: "requested_by", label: "Requested by", render: (item) => <div className="stacked-cell"><strong>{item.return_event?.actor?.full_name || "Authorized reviewer"}</strong><span>{formatDateTime(item.return_event?.created_at)}</span></div> },
    { key: "reason", label: "Correction reason", render: (item) => <span className="wrap-cell">{item.return_event?.comment || item.current_action}</span> },
    { key: "action", label: "Action", render: (item) => <Link className="text-link" to={`/corrections/${item.id}`}>Open correction <ArrowRight size={15} /></Link> }
  ], []);

  if (error && !records) return <><PageHeader eyebrow="Correction traceability" title="Returned agreements" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading returned agreements" />;

  return <>
    <PageHeader eyebrow="Correction traceability" title="Returned agreements" description="The current backend records corrections as workflow transition comments. This workspace derives the exact return reason from each agreement's audit history." meta={<span className="scope-note"><AlertTriangle size={15} /> {records.length} active return{records.length === 1 ? "" : "s"}</span>} />
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input aria-label="Search returned agreements" placeholder="Search reference, partner or correction reason…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></section>
    <section className="panel data-panel"><DataTable columns={columns} rows={filtered} onRowClick={(item) => navigate(`/corrections/${item.id}`)} emptyTitle="No active corrections" emptyText="Returned agreements within your backend-authorized scope will appear here." /></section>
  </>;
}
