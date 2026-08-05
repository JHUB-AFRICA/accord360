import { AlertTriangle, ArrowRight, CheckCircle2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";

export default function Corrections() {
  const [records, setRecords] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const load = useCallback(() => { setError(""); api("/corrections").then(setRecords).catch((requestError) => setError(requestError.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => (records || []).filter((item) => {
    const matchSearch = !search || [item.code, item.agreement_reference, item.agreement_title, item.exact_item].some((value) => String(value).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !status || item.status === status;
    return matchSearch && matchStatus;
  }), [records, search, status]);
  const columns = useMemo(() => [
    { key: "code", label: "Correction", render: (item) => <div className="stacked-cell"><strong>{item.code}</strong><span>{item.category}</span></div> },
    { key: "agreement_reference", label: "Agreement", render: (item) => <div className="stacked-cell"><strong>{item.agreement_reference}</strong><span>{item.agreement_title}</span></div> },
    { key: "exact_item", label: "Exact item" },
    { key: "requested_by", label: "Requested by" },
    { key: "due_date", label: "Due date", render: (item) => <div className="stacked-cell"><strong>{formatDate(item.due_date)}</strong><span>{new Date(item.due_date) < new Date() && item.status !== "resolved" ? "Overdue" : "Open"}</span></div> },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
    { key: "action", label: "Action", render: (item) => <Link className="text-link" to={`/corrections/${item.id}`}>Open <ArrowRight size={15} /></Link> }
  ], []);
  if (error) return <><PageHeader eyebrow="Correction traceability" title="Corrections and returns" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading correction workspace" />;
  return <>
    <PageHeader eyebrow="Correction traceability" title="Corrections and returns" description="Every request identifies the exact field, document, clause or template section requiring attention." />
    <section className="correction-summary"><article><AlertTriangle /><div><span>Open corrections</span><strong>{records.filter((item) => !["resolved", "closed"].includes(item.status)).length}</strong></div></article><article><CheckCircle2 /><div><span>Resolved</span><strong>{records.filter((item) => item.status === "resolved").length}</strong></div></article></section>
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input placeholder="Search correction, agreement or exact item…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="open">Open</option><option value="awaiting_response">Awaiting response</option><option value="submitted">Submitted</option><option value="resolved">Resolved</option></select></section>
    <section className="panel data-panel"><DataTable columns={columns} rows={filtered} onRowClick={(item) => navigate(`/corrections/${item.id}`)} emptyTitle="No corrections match this view" /></section>
  </>;
}
