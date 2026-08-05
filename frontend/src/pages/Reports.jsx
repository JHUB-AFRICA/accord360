import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, CheckCircle2, Download, FileBarChart, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api, downloadFile } from "../lib/api";

const reportCards = [
  ["Executive portfolio report", "Portfolio scale, activity, risk and value."],
  ["Agreement pipeline report", "Records by stage, status, office and turnaround."],
  ["Partner performance report", "Scorecards, engagement and deliverable performance."],
  ["Legal review report", "Legal queue, blocking comments and SLA performance."],
  ["Expiry and renewal report", "Upcoming expiry windows and renewal decisions."],
  ["Monitoring & evaluation report", "Six-month reporting, evidence and outputs."],
  ["Data quality report", "Missing fields, inconsistent statuses and incomplete records."],
  ["Country and agreement-type report", "Filtered portfolio distribution and trends."]
];

export default function Reports() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [aiNarrative, setAiNarrative] = useState("");
  const [filters, setFilters] = useState({ date_range: "last_12_months", agreement_type: "", faculty: "", country: "", risk: "" });
  const [generating, setGenerating] = useState(false);
  const load = useCallback(() => { setError(""); api("/reports/portfolio").then(setData).catch((requestError) => setError(requestError.message)); }, []);
  useEffect(() => { load(); }, [load]);
  async function generateAi() {
    setGenerating(true); setError("");
    try { const result = await api("/reports/ai-summary", { method: "POST", body: JSON.stringify(filters) }); setAiReport(result); setAiNarrative(result.narrative); setAiOpen(true); }
    catch (requestError) { setError(requestError.message); }
    finally { setGenerating(false); }
  }
  async function exportReport(path, fallbackName) {
    setError("");
    try {
      await downloadFile(path, fallbackName);
      setMessage(`${fallbackName} downloaded.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function approveAi() {
    if (!aiReport || !aiNarrative.trim()) { setError("Review and retain a complete executive narrative before approval."); return; }
    setGenerating(true); setError("");
    try {
      const approved = await api(`/reports/ai-summary/${aiReport.id}/approve`, { method: "POST", body: JSON.stringify({ narrative: aiNarrative }) });
      setAiReport(approved); setMessage(`AI-assisted summary approved by ${approved.approved_by}.`); setAiOpen(false);
    } catch (requestError) { setError(requestError.message); }
    finally { setGenerating(false); }
  }
  if (error && !data) return <><PageHeader eyebrow="Analytics and reporting" title="Reports centre" /><ErrorState message={error} onRetry={load} /></>;
  if (!data) return <LoadingState label="Loading reports centre" />;
  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Analytics and reporting" title="Reports centre" description="Generate filtered operational and executive reports from verified system records." actions={<><button className="secondary-button" onClick={() => exportReport("/reports/agreements.csv", "accord360-agreements.csv")}><Download size={17} /> CSV</button><button className="secondary-button" onClick={() => exportReport("/reports/export.xlsx", "accord360-report.xlsx")}><Download size={17} /> Excel</button><button className="secondary-button" onClick={() => exportReport("/reports/export.pdf", "accord360-report.pdf")}><Download size={17} /> PDF</button><button className="primary-button" onClick={generateAi} disabled={generating}><Sparkles size={17} /> {generating ? "Generating…" : "Generate AI summary"}</button></>} />
    <section className="panel report-filter-panel"><div><label>Date range<select value={filters.date_range} onChange={(e) => setFilters({ ...filters, date_range: e.target.value })}><option value="last_12_months">Last 12 months</option><option value="current_year">Current year</option><option value="last_quarter">Last quarter</option></select></label><label>Agreement type<select value={filters.agreement_type} onChange={(e) => setFilters({ ...filters, agreement_type: e.target.value })}><option value="">All types</option><option>MoU</option><option>MoA</option><option>CRA</option></select></label><label>Faculty<select value={filters.faculty} onChange={(e) => setFilters({ ...filters, faculty: e.target.value })}><option value="">All faculties</option><option>Engineering</option><option>Agriculture</option><option>Health Sciences</option></select></label><label>Country<select value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })}><option value="">All countries</option><option>Kenya</option><option>Uganda</option><option>Tanzania</option><option>Finland</option></select></label><label>Risk<select value={filters.risk} onChange={(e) => setFilters({ ...filters, risk: e.target.value })}><option value="">All risks</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div></section>
    <div className="report-card-grid">{reportCards.map(([title, text], index) => <article className="panel report-card" key={title}><div className={`report-icon report-icon-${index % 4}`}><FileBarChart size={21} /></div><h3>{title}</h3><p>{text}</p><button className="text-link" onClick={() => exportReport("/reports/agreements.csv", "accord360-report.csv")}>Export CSV</button></article>)}</div>
    <div className="dashboard-grid"><section className="panel chart-panel span-2"><div className="panel-head"><div><h2>Request trend</h2><p>Selected reporting period</p></div></div><div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.trend}><CartesianGrid strokeDasharray="4 4" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="requests" fill="#1b5e3b" radius={[7,7,0,0]} /></BarChart></ResponsiveContainer></div></section><aside className="panel risk-summary"><ShieldAlert size={30} /><h2>Portfolio risk</h2><strong>{data.totals.dormant_or_high_risk}</strong><p>Dormant or high-risk partnerships requiring management attention.</p></aside></div>
    <Modal open={aiOpen} onClose={() => setAiOpen(false)} title="AI-assisted executive summary" description="Draft generated from selected system records. Human review is mandatory." size="large" footer={<><button className="secondary-button" onClick={() => { setAiOpen(false); setAiReport(null); setAiNarrative(""); }}><RefreshCw size={16} /> Reject / regenerate</button>{["linkages", "director_linkages", "dvc", "executive"].includes(user.role) && <button className="primary-button" disabled={generating} onClick={approveAi}><CheckCircle2 size={16} /> {generating ? "Approving…" : "Approve and finalize"}</button>}</>}>
      {aiReport && <div className="ai-report"><div className="ai-label"><Bot /><div><strong>{aiReport.label}</strong><span>Generated {new Date(aiReport.generated_at).toLocaleString()}</span></div><StatusBadge tone="orange">Human review required</StatusBadge></div><textarea className="ai-narrative" value={aiNarrative} onChange={(event) => setAiNarrative(event.target.value)} rows="8" aria-label="Editable AI-generated narrative" /><div className="finding-grid">{aiReport.findings.map((finding) => <article key={finding.title}><span>{finding.title}</span><strong>{finding.value}</strong><p>{finding.action}</p><small>Support: {finding.support.join(", ")}</small></article>)}</div><div className="form-alert warning">{aiReport.disclaimer}</div></div>}
    </Modal>
  </>;
}
