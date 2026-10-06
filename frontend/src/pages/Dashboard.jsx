import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Gauge } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { getDashboard } from "../lib/backend.js";
import { roleConfig } from "../lib/roles.js";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import KpiCard from "../components/KpiCard.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { humanize } from "../lib/format.js";

const kpiIcons = [Gauge, ClipboardCheck, AlertTriangle, CheckCircle2];

// A small, role-scoped landing dashboard: real KPIs, two quick-glance charts
// (status breakdown and a 6-month creation trend, both from real
// /dashboard/stats data), and a priority queue of agreements needing this
// role's action (REBUILD_BRIEF.md Section 5.1).
export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const config = roleConfig(user.role);

  const load = useCallback(() => {
    setError("");
    setData(null);
    getDashboard().then(setData).catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const queueColumns = useMemo(() => [
    { key: "title", label: "Agreement", render: (item) => <div className="stacked-cell"><strong>{item.title}</strong><span>{item.partner_name}</span></div> },
    { key: "department", label: "Department" },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status}>{humanize(item.status)}</StatusBadge> }
  ], []);

  if (error) return <><PageHeader eyebrow={config.label} title={config.workspace} description={config.shortDescription} /><ErrorState message={error} onRetry={load} /></>;
  if (!data) return <LoadingState label="Loading your workspace" />;

  const workspace = data.workspace || {};
  const primaryAction = workspace.primary_action;
  const totalCreatedRecently = data.monthlyCreated.reduce((sum, item) => sum + item.count, 0);

  return (
    <>
      <PageHeader
        eyebrow={workspace.eyebrow || config.label}
        title={workspace.title || config.workspace}
        description={workspace.description || config.shortDescription}
        actions={primaryAction?.path && primaryAction?.label ? <Link className="primary-button" to={primaryAction.path}>{primaryAction.label} <ArrowRight size={17} /></Link> : null}
      />

      <section className="kpi-grid">
        {(data.kpis || []).map((item, index) => (
          <KpiCard
            key={item.label}
            label={item.label}
            value={item.value}
            helper={item.note}
            tone={item.tone || "blue"}
            icon={kpiIcons[index % kpiIcons.length]}
            to={item.statuses?.length ? `/agreements?status=${item.statuses.join(",")}` : "/agreements"}
          />
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel span-2">
          <div className="panel-head"><div><h2>Agreements by status</h2><p>Where every visible agreement currently stands.</p></div></div>
          <div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.byStatus}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5ecea" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#1b5e3b" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </article>

        <article className="panel chart-panel">
          <div className="panel-head"><div><h2>New agreements</h2><p>Last 6 months · {totalCreatedRecently} total</p></div></div>
          <div className="chart-height"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.monthlyCreated}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5ecea" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#1b5e3b" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
        </article>
      </section>

      <section className="panel data-panel">
        <div className="panel-head"><div><h2>{workspace.queue_title || "My priority queue"}</h2><p>{workspace.queue_description || "Agreements that currently need your action."}</p></div><Link to="/agreements" className="text-link">View all agreements <ArrowRight size={15} /></Link></div>
        <DataTable
          columns={queueColumns}
          rows={data.queue || []}
          onRowClick={(item) => navigate(`/agreements/${item.id}`)}
          emptyTitle="Nothing needs your attention"
          emptyText="Your queue is clear right now."
        />
      </section>
    </>
  );
}
