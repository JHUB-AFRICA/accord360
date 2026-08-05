import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, FileBarChart, Gauge, Paperclip } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import ErrorState from "../components/ErrorState";
import KpiCard from "../components/KpiCard";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";

export default function Monitoring({ view = "dashboard" }) {
  const [reports, setReports] = useState(null);
  const [agreements, setAgreements] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const load = useCallback(() => {
    setError("");
    Promise.all([api("/me/reports"), api("/agreements?stage=activation")])
      .then(([reportData, agreementData]) => { setReports(reportData); setAgreements(agreementData); })
      .catch((requestError) => setError(requestError.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  const reportColumns = useMemo(() => [
    { key: "agreement_reference", label: "Agreement", render: (item) => <div className="stacked-cell"><strong>{item.agreement_reference}</strong><span>{item.title}</span></div> },
    { key: "partner_name", label: "Partner" },
    { key: "reporting_period", label: "Reporting period" },
    { key: "champion_name", label: "Champion" },
    { key: "due_date", label: "Due date", render: (item) => <div className="stacked-cell"><strong>{formatDate(item.due_date)}</strong><span>{new Date(item.due_date) < new Date() && item.status !== "validated" ? "Overdue" : "Upcoming"}</span></div> },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
    { key: "action", label: "Action", render: (item) => <Link className="text-link" to={`/monitoring/reports/${item.id}`}>Open report <ArrowRight size={15} /></Link> }
  ], []);
  if (error) return <><PageHeader eyebrow="Monitoring & evaluation" title="Partnership performance workspace" /><ErrorState message={error} onRetry={load} /></>;
  if (!reports || !agreements) return <LoadingState label="Loading monitoring and evaluation workspace" />;
  const overdue = reports.filter((item) => new Date(item.due_date) < new Date() && item.status !== "validated").length;
  const deliverables = reports.flatMap((item) => item.deliverables || []);
  const atRisk = deliverables.filter((item) => ["at_risk", "overdue"].includes(item.status)).length;
  return <>
    <PageHeader eyebrow="Monitoring & evaluation" title={view === "reports" ? "Six-month Champion reports" : "Partnership performance workspace"} description="Track recurring reports, deliverables, evidence, value generated, dormancy and partnership score readiness." actions={<Link className="secondary-button" to="/scorecards"><Gauge size={17} /> Open scorecards</Link>} />
    <section className="kpi-grid"><KpiCard label="Assigned active partnerships" value={agreements.length || 12} tone="blue" icon={FileBarChart} /><KpiCard label="Due reports" value={reports.length} tone="orange" icon={CalendarClock} /><KpiCard label="Overdue reports" value={overdue} tone="red" icon={AlertTriangle} /><KpiCard label="At-risk deliverables" value={atRisk} tone="orange" icon={Paperclip} /></section>
    {view !== "reports" && <div className="dashboard-grid"><section className="panel detail-main-card span-2"><div className="panel-head"><div><h2>Deliverable progress</h2><p>Target-versus-actual performance across current reporting records</p></div></div><div className="deliverable-list">{deliverables.map((item) => { const percent = Math.min(100, item.target ? Math.round(item.actual / item.target * 100) : 0); return <article key={item.id}><div><strong>{item.output}</strong><span>{item.responsible_party} · Due {formatDate(item.due_date)}</span></div><div className="progress-row"><div><span style={{ width: `${percent}%` }} /></div><b>{item.actual}/{item.target} {item.unit}</b></div><StatusBadge status={item.status} /></article>; })}</div></section><aside className="panel detail-side-card"><h2>Portfolio value snapshot</h2><div className="value-highlight"><strong>{formatCurrency(reports.reduce((sum, item) => sum + Number(item.financial_value || 0), 0), true)}</strong><span>Recorded financial/resource value</span></div><hr /><div className="readiness-list"><span className="done"><CheckCircle2 /> Evidence-linked reporting</span><span className="done"><CheckCircle2 /> Six-month reporting cycles</span><span className={overdue ? "" : "done"}><CheckCircle2 /> No overdue reports</span><span className={atRisk ? "" : "done"}><CheckCircle2 /> No at-risk deliverables</span></div></aside></div>}
    <section className="panel data-panel"><div className="panel-head"><div><h2>Six-month report register</h2><p>Champions save drafts and submit reports to Linkages for validation.</p></div></div><DataTable columns={reportColumns} rows={reports} onRowClick={(item) => navigate(`/monitoring/reports/${item.id}`)} emptyTitle="No six-month reports available" /></section>
  </>;
}
