import { BarChart3, Download, FileSpreadsheet, FileText, Filter, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ErrorState from "../components/ErrorState.jsx";
import KpiCard from "../components/KpiCard.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { BACKEND_CAPABILITIES, exportAgreementsCsv, getDashboard } from "../lib/backend.js";

const initialFilters = { stage: "", status: "", agreement_type: "", department: "", partner_sector: "", expiry_from: "", expiry_to: "" };

function buildVerifiedNarrative(data) {
  const totals = data?.totals || {};
  const leadingType = [...(data?.by_type || [])].sort((a, b) => Number(b.value) - Number(a.value))[0];
  const leadingStage = [...(data?.by_stage || [])].sort((a, b) => Number(b.value) - Number(a.value))[0];
  return `The currently authorized portfolio contains ${totals.total_partnerships || 0} agreement records, including ${totals.active_agreements || 0} active partnerships and ${totals.pipeline || 0} records in the pipeline. ${leadingType ? `${leadingType.name} is the largest agreement category with ${leadingType.value} record(s).` : "No agreement-type distribution is available."} ${leadingStage ? `${leadingStage.name} is the largest current workflow stage with ${leadingStage.value} record(s).` : "No stage distribution is available."} ${totals.at_risk || 0} record(s) are currently flagged at risk. This deterministic preview uses only GET /dashboard/stats values and must be reviewed before use.`;
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [narrative, setNarrative] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try { setData(await getDashboard()); }
    catch (requestError) { setError(requestError.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const valueSummary = useMemo(() => (data?.totals?.value_by_currency || []).map((item) => `${item.currency} ${Number(item.amount || 0).toLocaleString()}`).join(" · ") || "No approved value totals", [data]);

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

  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Analytics and reporting" title="Reports centre" description="Dashboard statistics and CSV exports use the implemented backend routes. PDF, Excel and AI-report persistence remain unavailable until matching endpoints are added." actions={<><button className="secondary-button" disabled title="No Excel export endpoint is currently implemented"><FileSpreadsheet size={17} /> Excel</button><button className="secondary-button" disabled title="No PDF export endpoint is currently implemented"><FileText size={17} /> PDF</button><button className="primary-button" disabled={!BACKEND_CAPABILITIES.aiReports} title="No AI report endpoint is currently implemented"><Sparkles size={17} /> Generate AI summary</button></>} />

    <section className="kpi-grid"><KpiCard label="Total agreements" value={data.totals.total_partnerships} tone="blue" icon={BarChart3} /><KpiCard label="Active partnerships" value={data.totals.active_agreements} tone="green" icon={BarChart3} /><KpiCard label="Pipeline volume" value={data.totals.pipeline} tone="orange" icon={BarChart3} /><KpiCard label="At risk" value={data.totals.at_risk} tone="red" icon={BarChart3} /></section>

    <section className="panel">
      <div className="panel-head"><div><h2>Agreement CSV export</h2><p>Every filter below maps directly to GET /reports/agreements.csv.</p></div><StatusBadge tone="green">Implemented</StatusBadge></div>
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

    <section className="content-grid two-column">
      <article className="panel"><div className="panel-head"><div><h2>Verified portfolio distributions</h2><p>Returned by GET /dashboard/stats.</p></div></div><div className="report-distribution"><h3>By workflow stage</h3>{data.by_stage.map((item) => <div className="distribution-row" key={item.name}><span>{item.name}</span><strong>{item.value}</strong></div>)}<h3>By agreement type</h3>{data.by_type.map((item) => <div className="distribution-row" key={item.name}><span>{item.name}</span><strong>{item.value}</strong></div>)}</div><p className="form-help">Portfolio value: {valueSummary}</p></article>
      <article className="panel"><div className="panel-head"><div><h2>Human-review narrative preview</h2><p>Generated locally from verified dashboard totals; not an AI backend response.</p></div><StatusBadge tone="blue">Deterministic preview</StatusBadge></div>{narrative ? <textarea rows="12" value={narrative} onChange={(event) => setNarrative(event.target.value)} /> : <div className="inline-empty"><Sparkles /> Generate a reviewable preview without creating a server record.</div>}<div className="form-actions"><button className="secondary-button" onClick={() => setNarrative(buildVerifiedNarrative(data))}><Sparkles size={17} /> Build preview</button>{narrative && <button className="secondary-button" onClick={() => window.print()}><FileText size={17} /> Print reviewed page</button>}</div><p className="form-help">This summary was generated from selected system statistics. All figures and conclusions must be reviewed before approval or distribution.</p></article>
    </section>
  </>;
}
