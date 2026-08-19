import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Gauge } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { getDashboard } from "../lib/backend.js";
import { roleConfig } from "../lib/roles.js";
import { stageLabel } from "../lib/workflow.js";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import KpiCard from "../components/KpiCard.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const kpiIcons = [Gauge, ClipboardCheck, AlertTriangle, CheckCircle2];
const pieColors = ["#1b5e3b", "#7bc67e", "#1976d2", "#e5a100", "#6f42c1"];

const primaryLinks = {
  researcher: ["Create request", "/agreements/new"],
  approver: ["Open approval queue", "/approvals/queue"],
  linkages: ["Open Linkages queue", "/linkages/queue"],
  director_linkages: ["Open portfolio", "/agreements"],
  legal: ["Open Legal queue", "/legal/queue"],
  dvc: ["Open endorsement queue", "/dvc/queue"],
  vc_office: ["Open signing queue", "/signing/queue"],
  me: ["Open M&E workspace", "/monitoring"],
  executive: ["Open reports", "/reports"],
  admin: ["Manage users", "/users"],
  auditor: ["Open audit trail", "/audit"]
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const config = roleConfig(user.role);
  const primary = primaryLinks[user.role] || ["Open agreements", "/agreements"];

  const load = useCallback(() => {
    setError("");
    setData(null);
    getDashboard().then(setData).catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const queueColumns = useMemo(() => [
    { key: "reference", label: "Reference", render: (item) => <div className="stacked-cell"><strong>{item.reference}</strong><span>{item.title}</span></div> },
    { key: "partner_name", label: "Partner" },
    { key: "stage", label: "Stage", render: (item) => <div className="stacked-cell"><strong>{stageLabel(item.stage)}</strong><span>{item.backend_stage_label}</span></div> },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
    { key: "current_action", label: "Next action" }
  ], []);

  if (error) return <><PageHeader eyebrow={config.label} title={config.workspace} description={config.shortDescription} /><ErrorState message={error} onRetry={load} /></>;
  if (!data) return <LoadingState label="Loading your role-specific workspace" />;

  const workspace = data.workspace || {};
  const total = data.totals.total_partnerships;

  return (
    <>
      <PageHeader
        eyebrow={workspace.eyebrow || config.label}
        title={workspace.title || config.workspace}
        description={workspace.description || config.shortDescription}
        actions={<Link className="primary-button" to={primary[1]}>{primary[0]} <ArrowRight size={17} /></Link>}
        meta={<span className="demo-label">Live role-scoped data from /dashboard/workspace and /dashboard/stats</span>}
      />

      <section className="kpi-grid">
        {(data.kpis || []).map((item, index) => (
          <KpiCard key={item.label} label={item.label} value={item.value} helper={item.note} tone={item.tone || "blue"} icon={kpiIcons[index % kpiIcons.length]} />
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel span-2">
          <div className="panel-head"><div><h2>Agreements by stage</h2><p>Counts are scoped by the authenticated role on the backend.</p></div><Link to="/agreements">View all <ArrowRight size={15} /></Link></div>
          <div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.by_stage}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5ecea" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={70} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#1b5e3b" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </article>

        <article className="panel chart-panel">
          <div className="panel-head"><div><h2>Agreement mix</h2><p>Count by backend agreement type</p></div></div>
          <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.by_type} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3}>{data.by_type.map((entry, index) => <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{total}</strong><span>records</span></div></div>
          <div className="legend-list">{data.by_type.map((entry, index) => <span key={entry.name}><i style={{ background: pieColors[index % pieColors.length] }} />{entry.name}<b>{entry.value}</b></span>)}</div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel span-2">
          <div className="panel-head"><div><h2>Monthly pipeline</h2><p>Created agreements during the last six months</p></div></div>
          <div className="chart-height"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trend}><defs><linearGradient id="requestFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1b5e3b" stopOpacity={0.28} /><stop offset="95%" stopColor="#1b5e3b" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5ecea" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="requests" stroke="#1b5e3b" fill="url(#requestFill)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div>
        </article>

        <article className="panel detail-side-card">
          <div className="panel-head"><div><h2>Portfolio snapshot</h2><p>Backend-calculated metrics</p></div></div>
          <div className="metric-preview">
            <article><span>Active partnerships</span><strong>{data.totals.active_agreements}</strong></article>
            <article><span>Pipeline volume</span><strong>{data.totals.pipeline}</strong></article>
            <article><span>At risk</span><strong>{data.totals.at_risk}</strong></article>
            {(data.totals.value_by_currency || []).map((item) => <article key={item.currency}><span>Approved value ({item.currency})</span><strong>{Number(item.amount).toLocaleString()}</strong></article>)}
          </div>
        </article>
      </section>

      <section className="panel data-panel">
        <div className="panel-head"><div><h2>{workspace.queue_title || "My priority queue"}</h2><p>{workspace.queue_description || "Records that currently require attention."}</p></div></div>
        <DataTable
          columns={queueColumns}
          rows={data.queue || []}
          onRowClick={(item) => navigate(`/agreements/${item.id}`)}
          emptyTitle="No records require action"
          emptyText="Your backend-scoped queue is currently clear."
        />
      </section>
    </>
  );
}
