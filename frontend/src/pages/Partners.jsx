import { Building2, Filter, Search, UserCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { api } from "../lib/api";

export default function Partners() {
  const location = useLocation();
  const initialStatus = new URLSearchParams(location.search).get("status") || "";
  const [filters, setFilters] = useState({ search: "", status: initialStatus });
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(() => {
    setError("");
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    api(`/partners?${params}`).then(setRecords).catch((requestError) => setError(requestError.message));
  }, [filters]);

  useEffect(() => { const timer = setTimeout(load, 150); return () => clearTimeout(timer); }, [load]);

  const columns = useMemo(() => [
    { key: "name", label: "Institution", render: (item) => <div className="partner-name-cell"><span className="partner-table-icon"><Building2 size={18} /></span><div><strong>{item.name}</strong><span>{item.sector}</span></div></div> },
    { key: "country", label: "Country / region", render: (item) => <div className="stacked-cell"><strong>{item.country}</strong><span>{item.region}</span></div> },
    { key: "institution_type", label: "Institution type" },
    { key: "verification_status", label: "Verification", render: (item) => <StatusBadge status={item.verification_status} /> },
    { key: "active_collaborations", label: "Agreements" },
    { key: "champion_name", label: "Assigned Champion", render: (item) => item.champion_name || <StatusBadge tone="orange">Unassigned</StatusBadge> },
    { key: "risk", label: "Risk", render: (item) => <StatusBadge status={item.risk} risk /> },
    { key: "action", label: "Action", render: (item) => item.verification_status !== "verified" ? <Link className="text-link" to={`/partners/${item.id}/verify`}><UserCheck size={15} /> Verify</Link> : <Link className="text-link" to={`/partners/${item.id}`}>View profile</Link> }
  ], []);

  if (error) return <><PageHeader eyebrow="Partner management" title="Partner institution registry" /><ErrorState message={error} onRetry={load} /></>;

  return <>
    <PageHeader eyebrow="Partner management" title="Partner institution registry" description="Search institutions, review legitimacy status, detect duplication and open complete collaboration histories." />
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input placeholder="Search institution, country or sector…" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></div><div className="filter-controls always-open"><Filter size={17} /><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All verification statuses</option><option value="verified">Verified</option><option value="under_review">Under review</option><option value="additional_information_required">Additional information required</option><option value="rejected">Rejected</option></select></div></section>
    <section className="panel data-panel"><div className="panel-head"><div><h2>Partner records</h2><p>{records ? `${records.length} institution${records.length === 1 ? "" : "s"}` : "Loading institutions"}</p></div></div>{!records ? <LoadingState label="Loading partner registry" /> : <DataTable columns={columns} rows={records} onRowClick={(item) => navigate(`/partners/${item.id}`)} emptyTitle="No partner institutions match these filters" />}</section>
  </>;
}
