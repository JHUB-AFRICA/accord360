import { BarChart3, Download, Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ErrorState from "../components/ErrorState.jsx";
import KpiCard from "../components/KpiCard.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { exportAgreementsCsv, getPortfolioReport } from "../lib/backend.js";

const initialFilters = { stage: "", status: "", agreement_type: "", department: "", partner_sector: "", expiry_from: "", expiry_to: "" };

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

  const valueSummary = useMemo(() => (data?.value_by_currency || []).map((item) => `${item.currency} ${Number(item.amount || 0).toLocaleString()}`).join(" · ") || "No approved value totals", [data]);

  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      await exportAgreementsCsv(filters);
      setMessage("Scoped CSV export downloaded.");
    } catch (requestError) { setError(requestError.message); }
    finally { setExporting(false); }
  }

  if (error && !data) return <><PageHeader eyebrow="Analytics and reporting" title="Reports centre" /><ErrorState message={error} onRetry={load} /></>;
  if (!data) return <LoadingState label="Loading backend portfolio statistics" />;

  return <div className="reports-page">
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Analytics and reporting" title="Reports centre" />

    <section className="kpi-grid"><KpiCard label="Total agreements" value={data.totals.total_partnerships} tone="blue" icon={BarChart3} /><KpiCard label="Active partnerships" value={data.totals.active_agreements} tone="green" icon={BarChart3} /><KpiCard label="Pipeline volume" value={data.totals.pipeline} tone="orange" icon={BarChart3} /><KpiCard label="At risk" value={data.totals.at_risk} tone="red" icon={BarChart3} /></section>

    <section className="panel">
      <div className="panel-head"><div><h2>Scoped portfolio exports</h2><p>Every filter maps to the authorized portfolio snapshot and export endpoints.</p></div><StatusBadge tone="green">Implemented</StatusBadge></div>
      <div className="form-grid three-column">
        <label className="form-field"><span>Stage</span><select value={filters.stage} onChange={(event) => setFilters({ ...filters, stage: event.target.value })}><option value="">All stages</option>{["initiation", "department_approval", "linkages_review", "legal_review", "dvc_approval", "vc_submission", "validation_signing", "active", "renewal_closure", "archived"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
        <label className="form-field"><span>Status</span><input value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} placeholder="e.g. active" /></label>
        <label className="form-field"><span>Agreement type</span><select value={filters.agreement_type} onChange={(event) => setFilters({ ...filters, agreement_type: event.target.value })}><option value="">All types</option>{["MoU", "CRA", "CA", "Other"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="form-field"><span>Department</span><input value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })} /></label>
        <label className="form-field"><span>Partner sector</span><input value={filters.partner_sector} onChange={(event) => setFilters({ ...filters, partner_sector: event.target.value })} /></label>
        <label className="form-field"><span>Expiry from</span><input type="date" value={filters.expiry_from} onChange={(event) => setFilters({ ...filters, expiry_from: event.target.value })} /></label>
        <label className="form-field"><span>Expiry to</span><input type="date" value={filters.expiry_to} onChange={(event) => setFilters({ ...filters, expiry_to: event.target.value })} /></label>
      </div>
      <div className="form-actions"><button className="secondary-button" onClick={() => setFilters(initialFilters)}><Filter size={17} /> Clear filters</button><button className="primary-button" disabled={exporting} onClick={exportCsv}><Download size={17} /> {exporting ? "Exporting…" : "Download CSV"}</button></div>
    </section>

    <section className="panel report-distributions-card"><div className="panel-head"><div><h2>Verified portfolio distributions</h2><p>Returned by GET /reports/portfolio and scoped to your authorized records.</p></div></div><div className="report-distribution"><div className="distribution-group"><h3>By workflow stage</h3>{data.by_stage.map((item) => <div className="distribution-row" key={item.name}><span>{item.name}</span><strong>{item.value}</strong></div>)}</div><div className="distribution-group"><h3>By agreement type</h3>{data.by_type.map((item) => <div className="distribution-row" key={item.name}><span>{item.name}</span><strong>{item.value}</strong></div>)}</div></div><p className="form-help">Portfolio value: {valueSummary}</p></section>
  </div>;
}
