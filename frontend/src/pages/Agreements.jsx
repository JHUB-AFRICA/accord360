import { Download, Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { exportAgreementsCsv, listAgreements } from "../lib/backend.js";
import { canCreateAgreement } from "../lib/roles.js";
import { formatDate, humanize } from "../lib/format.js";
const agreementStatuses = ["draft_generated", "linkages_review", "legal_review", "returned_to_researcher", "approved_for_signing", "awaiting_signatures", "fully_executed", "expired", "archived"];
const agreementTypes = ["MoU", "CRA", "CA", "Other"];

function useQueryFilters() {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      search: params.get("search") || "",
      status: params.get("status") || "",
      agreement_type: params.get("agreement_type") || params.get("type") || "",
      department: params.get("department") || "",
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
    const { risk, ...backendFilters } = filters;
    listAgreements(backendFilters)
      .then((items) => setRecords(risk ? items.filter((item) => item.risk === risk) : items))
      .catch((requestError) => setError(requestError.message));
  }, [filters]);

  useEffect(() => {
    const timeout = setTimeout(load, 180);
    return () => clearTimeout(timeout);
  }, [load]);

  function updateFilter(key, value) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    const params = new URLSearchParams();
    Object.entries(next).forEach(([filterKey, filterValue]) => { if (filterValue) params.set(filterKey, filterValue); });
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }

  function clearFilters() {
    setFilters({ search: "", status: "", agreement_type: "", department: "", risk: "" });
    navigate(location.pathname, { replace: true });
  }

  async function exportAgreements() {
    setError("");
    try {
      await exportAgreementsCsv({
        status: filters.status,
        agreement_type: filters.agreement_type,
        department: filters.department
      });
      setMessage("Agreement register downloaded.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const columns = useMemo(() => [
    { key: "reference", label: "Reference", render: (item) => <div className="stacked-cell"><strong>{item.reference}</strong><span>{item.title}</span></div> },
    { key: "partner_name", label: "Partner", render: (item) => <div className="stacked-cell"><strong>{item.partner_name}</strong><span>{item.department}</span></div> },
    { key: "agreement_type", label: "Type", render: (item) => <StatusBadge tone="blue">{item.agreement_type}</StatusBadge> },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
    { key: "risk", label: "Risk", render: (item) => <StatusBadge status={item.risk} risk /> },
    { key: "updated_at", label: "Updated", render: (item) => formatDate(item.updated_at) }
  ], []);

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader
        eyebrow="Agreement portfolio"
        title="Agreement register"
        description="Search and filter records scoped by the authenticated backend role."
        actions={<>{canCreateAgreement(user.role) && <Link className="primary-button" to="/agreements/new"><Plus size={17} /> Create request</Link>}<button className="secondary-button" onClick={exportAgreements}><Download size={17} /> Export CSV</button></>}
      />

      <section className="panel filter-panel">
        <div className="search-field"><Search size={18} /><input aria-label="Search agreements" placeholder="Search reference, title or partner…" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} /></div>
        <button className="secondary-button filter-toggle" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters}><Filter size={17} /> Filters</button>
        <div className={`filter-controls ${showFilters ? "filter-controls-open" : ""}`}>
          <select aria-label="Filter by agreement type" value={filters.agreement_type} onChange={(event) => updateFilter("agreement_type", event.target.value)}><option value="">All agreement types</option>{agreementTypes.map((type) => <option key={type}>{type}</option>)}</select>
          <select aria-label="Filter by status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{agreementStatuses.map((status) => <option value={status} key={status}>{humanize(status)}</option>)}</select>
          <input aria-label="Filter by department" placeholder="Department" value={filters.department} onChange={(event) => updateFilter("department", event.target.value)} />
          <select aria-label="Filter by risk" value={filters.risk} onChange={(event) => updateFilter("risk", event.target.value)}><option value="">All risk levels</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
          <button className="text-button" onClick={clearFilters}><SlidersHorizontal size={15} /> Clear filters</button>
        </div>
      </section>

      <section className="panel data-panel">
        <div className="panel-head"><div><h2>Records</h2><p>{records ? `${records.length} record${records.length === 1 ? "" : "s"} in the current view` : "Loading records"}</p></div><span className="scope-note">Backend-enforced role and agreement scope</span></div>
        {error && !records ? <ErrorState message={error} onRetry={load} /> : !records ? <LoadingState label="Loading agreement register" /> : <DataTable columns={columns} rows={records} onRowClick={(item) => navigate(`/agreements/${item.id}`)} emptyTitle="No agreements match these filters" emptyText="Adjust the filters or create a new request if your role permits it." />}
      </section>
    </>
  );
}
