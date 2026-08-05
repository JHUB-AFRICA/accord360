import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, Bell, Building2, CalendarClock, CheckCircle2, ClipboardCheck, FileClock, FileSignature, Gauge, Scale, ShieldAlert, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { roleConfig } from "../lib/roles";
import { stageLabel } from "../lib/workflow";
import DataTable from "../components/DataTable";
import ErrorState from "../components/ErrorState";
import KpiCard from "../components/KpiCard";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

const kpiIcons = [Gauge, ClipboardCheck, AlertTriangle, CheckCircle2];
const pieColors = ["#1b5e3b", "#7bc67e", "#1976d2", "#e5a100"];

const roleContent = {
  researcher: { eyebrow: "Researcher & Champion", title: "My partnership workspace", description: "Focus on drafts, required corrections, requests under review and active partnership obligations.", primary: ["Create request", "/agreements/new"] },
  approver: { eyebrow: "Faculty approval", title: "Academic-fit review dashboard", description: "Review requests assigned to your faculty or department and return precise corrections when required.", primary: ["Open approval queue", "/approvals/queue"] },
  linkages: { eyebrow: "Directorate operations", title: "Linkages Officer dashboard", description: "Coordinate partner verification, agreement routing, delayed tasks and institutional hand-offs.", primary: ["Verify partners", "/partners?status=under_review"] },
  director_linkages: { eyebrow: "Directorate oversight", title: "Partnership portfolio and escalations", description: "Track portfolio health, overdue stages, performance, expiry and renewal decisions.", primary: ["Open portfolio", "/agreements"] },
  legal: { eyebrow: "University Legal Office", title: "Legal review dashboard", description: "Prioritize unresolved clause issues, review SLAs and legally approve complete drafts.", primary: ["Open Legal queue", "/legal/queue"] },
  dvc: { eyebrow: "DVC RPE", title: "Endorsement dashboard", description: "Review legally approved packages and either endorse them or return them with mandatory remarks.", primary: ["Open endorsement queue", "/dvc/queue"] },
  vc_office: { eyebrow: "Vice Chancellor's Office", title: "Submission and signing dashboard", description: "Manage VC packages, institutional signatures, partner signatures and executed agreements.", primary: ["Open signing queue", "/signing/queue"] },
  me: { eyebrow: "Monitoring & Evaluation", title: "Partnership performance dashboard", description: "Validate six-month reports, evidence, deliverables, dormancy alerts and scorecards.", primary: ["Open M&E reports", "/monitoring/reports"] },
  executive: { eyebrow: "Executive oversight", title: "Institutional partnership overview", description: "View portfolio scale, risk, approval performance and M&E completion without operational editing.", primary: ["Open executive reports", "/reports"] },
  admin: { eyebrow: "System administration", title: "Configuration and access dashboard", description: "Maintain users, roles, reference data and governance configuration without performing business approvals.", primary: ["Manage users", "/users"] },
  auditor: { eyebrow: "Audit & compliance", title: "Compliance review dashboard", description: "Inspect authorized records, workflow history, risk signals and immutable audit events.", primary: ["Open audit trail", "/audit"] },
  partner: { eyebrow: "External partner portal", title: "My collaboration dashboard", description: "Track shared partnership requests, respond to corrections and access approved records only.", primary: ["Open my requests", "/partner/requests"] }
};

function AgreementCell({ item }) {
  return <div className="stacked-cell"><strong>{item.reference}</strong><span>{item.title}</span></div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const content = roleContent[user.role] || { eyebrow: "Accord360", title: roleConfig(user.role).workspace, description: roleConfig(user.role).shortDescription, primary: ["Open agreements", "/agreements"] };

  const load = useCallback(() => {
    setError("");
    api("/dashboard").then(setData).catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const agreementColumns = useMemo(() => [
    { key: "reference", label: "Agreement", render: (item) => <AgreementCell item={item} /> },
    { key: "partner_name", label: "Partner" },
    { key: "agreement_type", label: "Type", render: (item) => <StatusBadge tone="blue">{item.agreement_type}</StatusBadge> },
    { key: "stage", label: "Current stage", render: (item) => <div className="stacked-cell"><strong>{stageLabel(item.stage)}</strong><span>{item.days_in_stage} days in stage</span></div> },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
    { key: "risk", label: "Risk", render: (item) => <StatusBadge status={item.risk} risk /> }
  ], []);

  if (error) return <><PageHeader eyebrow={content.eyebrow} title={content.title} description={content.description} /><ErrorState message={error} onRetry={load} /></>;
  if (!data) return <LoadingState label="Loading your role-specific workspace" />;

  return (
    <>
      <PageHeader eyebrow={content.eyebrow} title={content.title} description={content.description} actions={<Link className="primary-button" to={content.primary[1]}>{content.primary[0]} <ArrowRight size={17} /></Link>} meta={<span className="demo-label">Demonstration data for prototype purposes</span>} />

      <section className="kpi-grid">{data.kpis.map((item, index) => <KpiCard key={item.label} {...item} icon={kpiIcons[index % kpiIcons.length]} />)}</section>

      <section className="dashboard-grid">
        <article className="panel chart-panel span-2">
          <div className="panel-head"><div><h2>Requests and agreements by stage</h2><p>Only records visible within your assigned scope are included.</p></div><Link to="/agreements">View all <ArrowRight size={15} /></Link></div>
          <div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.by_stage}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5ecea" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={70} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#1b5e3b" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </article>
        <article className="panel chart-panel">
          <div className="panel-head"><div><h2>Agreement mix</h2><p>Portfolio distribution by type</p></div></div>
          <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.by_type} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3}>{data.by_type.map((entry, index) => <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{data.totals.total_partnerships}</strong><span>partnerships</span></div></div>
          <div className="legend-list">{data.by_type.map((entry, index) => <span key={entry.name}><i style={{ background: pieColors[index % pieColors.length] }} />{entry.name}<b>{entry.value}%</b></span>)}</div>
        </article>
      </section>

      {!["admin", "auditor"].includes(user.role) && <section className="dashboard-grid">
        <article className="panel chart-panel span-2">
          <div className="panel-head"><div><h2>Request trend</h2><p>Monthly intake trend across the demonstration portfolio</p></div></div>
          <div className="chart-height"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trend}><defs><linearGradient id="requestFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1b5e3b" stopOpacity={0.28} /><stop offset="95%" stopColor="#1b5e3b" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5ecea" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="requests" stroke="#1b5e3b" fill="url(#requestFill)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div>
        </article>
        <article className="panel quick-actions-card">
          <div className="panel-head"><div><h2>Priority shortcuts</h2><p>Actions relevant to your role</p></div></div>
          <div className="quick-action-list">
            {user.role === "linkages" && <><Link to="/partners?status=under_review"><Building2 /><span><strong>Verify institutions</strong><small>Review legitimacy and supporting evidence</small></span><ArrowRight /></Link><Link to="/corrections"><FileClock /><span><strong>Correction desk</strong><small>Track exact requested changes</small></span><ArrowRight /></Link></>}
            {user.role === "legal" && <Link to="/legal/queue"><ShieldAlert /><span><strong>Blocking comments</strong><small>Resolve clause-level issues before approval</small></span><ArrowRight /></Link>}
            {user.role === "dvc" && <Link to="/dvc/queue"><Scale /><span><strong>Endorsement packages</strong><small>Review Legal-approved submissions</small></span><ArrowRight /></Link>}
            {user.role === "vc_office" && <Link to="/signing/queue"><FileSignature /><span><strong>Signing packages</strong><small>Track JKUAT and partner execution</small></span><ArrowRight /></Link>}
            {user.role === "me" && <><Link to="/monitoring/reports"><CalendarClock /><span><strong>Six-month reports</strong><small>Validate overdue and submitted reports</small></span><ArrowRight /></Link><Link to="/scorecards"><Gauge /><span><strong>Scorecards</strong><small>Review weighted partnership performance</small></span><ArrowRight /></Link></>}
            {user.role === "researcher" && <><Link to="/agreements/new"><ClipboardCheck /><span><strong>Create a request</strong><small>Use the guided six-step wizard</small></span><ArrowRight /></Link><Link to="/corrections"><AlertTriangle /><span><strong>Respond to corrections</strong><small>Open exact requested changes</small></span><ArrowRight /></Link></>}
            {user.role === "partner" && <><Link to="/corrections"><AlertTriangle /><span><strong>Required actions</strong><small>Respond to Linkages requests</small></span><ArrowRight /></Link><Link to="/partner/documents"><FileClock /><span><strong>Shared documents</strong><small>Access approved partner-visible files</small></span><ArrowRight /></Link></>}
            {["executive", "director_linkages"].includes(user.role) && <><Link to="/reports"><BarChart3 /><span><strong>Portfolio analytics</strong><small>Review value, risk and pipeline metrics</small></span><ArrowRight /></Link><Link to="/scorecards"><Gauge /><span><strong>Partnership scorecards</strong><small>Compare performance across partnerships</small></span><ArrowRight /></Link></>}
            {user.role === "approver" && <Link to="/approvals/queue"><ClipboardCheck /><span><strong>Approval queue</strong><small>Review academic fit and expected outcomes</small></span><ArrowRight /></Link>}
          </div>
        </article>
      </section>}

      <section className="panel data-panel">
        <div className="panel-head"><div><h2>{user.role === "partner" ? "My partnership requests" : "Priority agreement records"}</h2><p>Current records requiring awareness or action</p></div><Link to="/agreements">Open register <ArrowRight size={15} /></Link></div>
        <DataTable columns={agreementColumns} rows={data.agreements} onRowClick={(item) => navigate(`/agreements/${item.id}`)} emptyTitle="No agreement records" />
      </section>

      <section className="dashboard-grid">
        <article className="panel list-panel">
          <div className="panel-head"><div><h2>Required corrections</h2><p>Exact fields, documents or clauses needing attention</p></div><Link to="/corrections">View all</Link></div>
          <div className="compact-list">{data.corrections.map((item) => <Link to={`/corrections/${item.id}`} key={item.id}><span className="list-icon orange"><AlertTriangle size={17} /></span><div><strong>{item.code} · {item.category}</strong><span>{item.agreement_reference}</span><small>Due {formatDate(item.due_date)}</small></div><StatusBadge status={item.status} /></Link>)}{!data.corrections.length && <div className="inline-empty"><CheckCircle2 /> No open corrections in your scope.</div>}</div>
        </article>
        <article className="panel list-panel">
          <div className="panel-head"><div><h2>Recent notifications</h2><p>Action-linked workflow updates</p></div><Link to="/notifications">View all</Link></div>
          <div className="compact-list">{data.notifications.map((item) => <Link to={item.link || "/notifications"} key={item.id}><span className="list-icon blue"><Bell size={17} /></span><div><strong>{item.title}</strong><span>{item.record_reference}</span><small>{item.required_action}</small></div><StatusBadge tone={item.priority === "critical" ? "red" : item.priority === "high" ? "orange" : "blue"}>{item.priority}</StatusBadge></Link>)}{!data.notifications.length && <div className="inline-empty"><CheckCircle2 /> No new notifications.</div>}</div>
        </article>
      </section>
    </>
  );
}
