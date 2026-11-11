import { BarChart3, CheckCircle2, Download, Filter } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ErrorState from "../components/ErrorState.jsx";
import KpiCard from "../components/KpiCard.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Toast from "../components/Toast.jsx";
import { exportAgreementsCsv, getPortfolioReport } from "../lib/backend.js";
import { humanize } from "../lib/format.js";

const agreementStatuses = ["draft_generated", "linkages_review", "legal_review", "returned_to_researcher", "approved_for_signing", "awaiting_signatures", "fully_executed", "expired", "archived"];
const initialFilters = { status: "", department: "", partner_sector: "", expiry_from: "", expiry_to: "" };

export default function Reports() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try { setData(await getPortfolioReport(filters)); }
    catch (requestError) { setError(requestError.message); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      await exportAgreementsCsv(filters);
      setMessage("Scoped CSV export downloaded.");
    } catch (requestError) { setError(requestError.message); }
    finally { setExporting(false); }
  }

  if (error && !data) return <><PageHeader eyebrow="Analytics and reporting" title="Reports" /><ErrorState message={error} onRetry={load} /></>;
  if (!data) return <LoadingState label="Loading portfolio statistics" />;

  return <div className="reports-page">
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Analytics and reporting" title="Reports" description="Where the visible portfolio stands, broken down by department and partner sector." />

    <section className="kpi-grid">
      <KpiCard label="Total agreements" value={data.totals.total_agreements} tone="blue" icon={BarChart3} />
      <KpiCard label="Fully executed" value={data.totals.fully_executed} tone="green" icon={CheckCircle2} />
      <KpiCard label="Expired" value={data.totals.expired} tone="orange" icon={BarChart3} />
      <KpiCard label="Archived" value={data.totals.archived} tone="slate" icon={BarChart3} />
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Filter and export</h2><p>Filters apply to both the breakdown below and the CSV export.</p></div></div>
      <div className="form-grid three-column">
        <label className="form-field"><span>Status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{agreementStatuses.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>
        <label className="form-field"><span>Department</span><input value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })} placeholder="e.g. Computing" /></label>
        <label className="form-field"><span>Partner sector</span><input value={filters.partner_sector} onChange={(event) => setFilters({ ...filters, partner_sector: event.target.value })} placeholder="e.g. Higher Education" /></label>
        <label className="form-field"><span>Expiry from</span><input type="date" value={filters.expiry_from} onChange={(event) => setFilters({ ...filters, expiry_from: event.target.value })} /></label>
        <label className="form-field"><span>Expiry to</span><input type="date" value={filters.expiry_to} onChange={(event) => setFilters({ ...filters, expiry_to: event.target.value })} /></label>
      </div>
      <div className="form-actions"><button className="secondary-button" onClick={() => setFilters(initialFilters)}><Filter size={17} /> Clear filters</button><button className="primary-button" disabled={exporting} onClick={exportCsv}><Download size={17} /> {exporting ? "Exporting…" : "Download CSV"}</button></div>
    </section>

    <section className="panel report-distributions-card">
      <div className="panel-head"><div><h2>Portfolio breakdown</h2><p>{data.records.length} agreement{data.records.length === 1 ? "" : "s"} match the current filters.</p></div></div>
      <div className="report-distribution">
        <div className="distribution-group"><h3>By department</h3>{data.by_department.map((item) => <div className="distribution-row" key={item.name}><span>{item.name}</span><strong>{item.value}</strong></div>)}{!data.by_department.length && <p className="empty-state">No records match these filters.</p>}</div>
        <div className="distribution-group"><h3>By partner sector</h3>{data.by_sector.map((item) => <div className="distribution-row" key={item.name}><span>{item.name}</span><strong>{item.value}</strong></div>)}{!data.by_sector.length && <p className="empty-state">No records match these filters.</p>}</div>
      </div>
    </section>
  </div>;
}
