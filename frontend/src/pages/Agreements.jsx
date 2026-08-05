import { Download, Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api, downloadFile } from "../lib/api";
import { canCreateAgreement } from "../lib/roles";
import { formatDate } from "../lib/format";
import { WORKFLOW_STAGES, stageLabel } from "../lib/workflow";

function useQueryFilters() {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      search: params.get("search") || "",
      stage: params.get("stage") || "",
      status: params.get("status") || "",
      type: params.get("type") || "",
      risk: params.get("risk") || ""
    };
  }, [location.search]);
}

export default function Agreements() {
  const { user } = useAuth();
  const initialFilters = useQueryFilters();
  const [filters, setFilters] = useState(initialFilters);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => setFilters(initialFilters), [initialFilters]);

  const load = useCallback(() => {
    setError("");
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    api(`/agreements?${params.toString()}`).then(setRecords).catch((requestError) => setError(requestError.message));
  }, [filters]);

  useEffect(() => { const timeout = setTimeout(load, 180); return () => clearTimeout(timeout); }, [load]);

  function updateFilter(key, value) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    const params = new URLSearchParams();
    Object.entries(next).forEach(([filterKey, filterValue]) => { if (filterValue) params.set(filterKey, filterValue); });
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }

  function clearFilters() {
    setFilters({ search: "", stage: "", status: "", type: "", risk: "" });
    navigate(location.pathname, { replace: true });
  }

  async function exportAgreements() {
    setError("");
    try {
      await downloadFile("/reports/agreements.csv", "accord360-agreements.csv");
      setMessage("Agreement register downloaded.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const columns = useMemo(() => [
    { key: "reference", label: "Reference", render: (item) => <div className="stacked-cell"><strong>{item.reference}</strong><span>{item.title}</span></div> },
    { key: "partner_name", label: "Partner", render: (item) => <div className="stacked-cell"><strong>{item.partner_name}</strong><span>{item.country || item.department}</span></div> },
    { key: "agreement_type", label: "Type", render: (item) => <StatusBadge tone="blue">{item.agreement_type}</StatusBadge> },
    { key: "department", label: "Ownership", render: (item) => <div className="stacked-cell"><strong>{item.department}</strong><span>{item.faculty}</span></div> },
    { key: "stage", label: "Current stage", render: (item) => <div className="stacked-cell"><strong>{stageLabel(item.stage)}</strong><span>{item.days_in_stage} days</span></div> },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
    { key: "risk", label: "Risk", render: (item) => <StatusBadge status={item.risk} risk /> },
    { key: "updated_at", label: "Updated", render: (item) => formatDate(item.updated_at) }
  ], []);

  if (error) return <><PageHeader eyebrow="Agreement portfolio" title="Agreement register" description="Search and filter records available within your role and organization scope." /><ErrorState message={error} onRetry={load} /></>;

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader eyebrow="Agreement portfolio" title={user.role === "partner" ? "My partnership requests" : "Agreement register"} description="Search, filter and open role-scoped records across the canonical Accord360 lifecycle." actions={<>{canCreateAgreement(user.role) && <Link className="primary-button" to="/agreements/new"><Plus size={17} /> Create request</Link>}<button className="secondary-button" onClick={exportAgreements}><Download size={17} /> Export</button></>} />

      <section className="panel filter-panel">
        <div className="search-field"><Search size={18} /><input aria-label="Search agreements" placeholder="Search reference, title or partner…" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} /></div>
        <button className="secondary-button filter-toggle" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters}><Filter size={17} /> Filters</button>
        <div className={`filter-controls ${showFilters ? "filter-controls-open" : ""}`}>
          <select aria-label="Filter by agreement type" value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}><option value="">All agreement types</option><option>MoU</option><option>MoA</option><option>CRA</option><option value="CA">CA — configuration pending</option></select>
          <select aria-label="Filter by stage" value={filters.stage} onChange={(event) => updateFilter("stage", event.target.value)}><option value="">All lifecycle stages</option>{WORKFLOW_STAGES.map((stage) => <option value={stage.key} key={stage.key}>{stage.label}</option>)}</select>
          <select aria-label="Filter by status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="correction_required">Correction required</option><option value="ready">Ready</option><option value="active">Active</option><option value="rejected">Rejected</option></select>
          <select aria-label="Filter by risk" value={filters.risk} onChange={(event) => updateFilter("risk", event.target.value)}><option value="">All risk levels</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
          <button className="text-button" onClick={clearFilters}><SlidersHorizontal size={15} /> Clear filters</button>
        </div>
      </section>

      <section className="panel data-panel">
        <div className="panel-head"><div><h2>Records</h2><p>{records ? `${records.length} record${records.length === 1 ? "" : "s"} in the current view` : "Loading records"}</p></div><span className="scope-note">Showing records permitted for your role</span></div>
        {!records ? <LoadingState label="Loading agreement register" /> : <DataTable columns={columns} rows={records} onRowClick={(item) => navigate(`/agreements/${item.id}`)} emptyTitle="No agreements match these filters" emptyText="Adjust the filters or create a new request if your role permits it." />}
      </section>
    </>
  );
}
