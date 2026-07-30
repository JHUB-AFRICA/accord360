import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileSignature,
  FileWarning,
  Gavel,
  Handshake,
  MonitorCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users
} from "lucide-react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { api } from "../lib/api";

const chartColors = ["#96be4c", "#6f9135", "#2563eb", "#e9c46a", "#f4a261", "#e76f51"];
const metricIcons = {
  agreements: Handshake,
  pending: Clock3,
  risk: FileWarning,
  value: CircleDollarSign,
  approvals: ClipboardCheck,
  legal: Gavel,
  signing: FileSignature,
  monitoring: MonitorCheck,
  users: Users,
  audit: ShieldCheck,
  complete: CheckCircle2,
  analytics: BarChart3
};

function MetricCard({ metric }) {
  const Icon = metricIcons[metric.icon] || Handshake;
  return (
    <div className={`kpi-card kpi-${metric.tone || "green"}`}>
      <div className="kpi-top"><span>{metric.label}</span><div className="kpi-icon"><Icon size={20} /></div></div>
      <strong>{metric.value}</strong>
      <p>{metric.note}</p>
    </div>
  );
}

export default function Dashboard() {
  const [workspace, setWorkspace] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [workspaceData, statsData] = await Promise.all([
        api("/dashboard/workspace"),
        api("/dashboard/stats")
      ]);
      setWorkspace(workspaceData);
      setPortfolio(statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="panel page-loading"><RefreshCw className="spin" /> Loading your role workspace...</div>;
  if (error || !workspace) return <div className="panel page-loading">{error || "Workspace unavailable."}</div>;

  return (
    <>
      <PageHeader
        eyebrow={workspace.eyebrow}
        title={workspace.title}
        description={workspace.description}
        actions={workspace.primary_action ? <Link className="primary-button" to={workspace.primary_action.path}><Plus size={18} /> {workspace.primary_action.label}</Link> : null}
      />

      <div className="role-workspace-banner">
        <div>
          <span>Your permissions are active</span>
          <strong>{workspace.role_label}</strong>
          <p>{workspace.permission_summary}</p>
        </div>
        <div className="permission-chips">
          {workspace.capabilities.map((capability) => <span key={capability}><CheckCircle2 size={15} /> {capability}</span>)}
        </div>
      </div>

      <section className="kpi-grid">
        {workspace.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      <section className="dashboard-grid dashboard-grid-main">
        <div className="panel span-2">
          <div className="panel-head">
            <div><h3>{workspace.queue_title}</h3><p>{workspace.queue_description}</p></div>
            <Link to="/agreements" className="text-link">View permitted records <ArrowRight size={15} /></Link>
          </div>
          {workspace.queue.length === 0 ? (
            <div className="workspace-empty"><CheckCircle2 size={34} /><strong>No items need your action</strong><p>Your role queue is currently clear.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Agreement</th><th>Partner</th><th>Stage</th><th>Required action</th><th>Status</th></tr></thead>
                <tbody>{workspace.queue.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Agreement"><Link className="table-title" to={`/agreements/${item.id}`}>{item.title}</Link><span>{item.reference_number}</span></td>
                    <td data-label="Partner">{item.partner}</td>
                    <td data-label="Stage">{item.stage.replaceAll("_", " ")}</td>
                    <td data-label="Required action">{item.next_action || "Review record"}</td>
                    <td data-label="Status"><StatusBadge color={item.status_color}>{item.status.replaceAll("_", " ")}</StatusBadge></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel workspace-guide">
          <div className="panel-head"><div><h3>What you can do here</h3><p>Functions assigned to your institutional role</p></div></div>
          <div className="workspace-step-list">
            {workspace.guidance.map((item, index) => (
              <div key={item} className="workspace-step"><span>{index + 1}</span><p>{item}</p></div>
            ))}
          </div>
        </div>
      </section>

      {portfolio && workspace.show_portfolio_analytics && (
        <>
          <section className="dashboard-grid dashboard-grid-main">
            <div className="panel chart-panel span-2">
              <div className="panel-head"><div><h3>Agreement pipeline</h3><p>Role-scoped requests created in the last six months</p></div><span className="panel-chip">Live data</span></div>
              <div className="chart-height">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={portfolio.monthly_pipeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="pipelineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#96be4c" stopOpacity={0.32} /><stop offset="100%" stopColor="#96be4c" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                    <Area type="monotone" dataKey="count" stroke="#96be4c" strokeWidth={3} fill="url(#pipelineFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel chart-panel">
              <div className="panel-head"><div><h3>Portfolio mix</h3><p>Visible agreements by type</p></div></div>
              <div className="chart-height chart-height-pie">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={portfolio.by_type} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={4}>
                      {portfolio.by_type.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="dashboard-grid">
            <div className="panel chart-panel">
              <div className="panel-head"><div><h3>Lifecycle position</h3><p>Visible records by workflow stage</p></div></div>
              <div className="chart-height">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={portfolio.by_stage} layout="vertical" margin={{ top: 5, right: 15, left: 18, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#96be4c" radius={[0, 7, 7, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel span-2">
              <div className="panel-head"><div><h3>Recently updated records</h3><p>Latest agreements visible to your role</p></div></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Agreement</th><th>Partner</th><th>Stage</th><th>Status</th></tr></thead>
                  <tbody>{portfolio.recent_agreements.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Agreement"><Link className="table-title" to={`/agreements/${item.id}`}>{item.title}</Link><span>{item.reference_number}</span></td>
                      <td data-label="Partner">{item.partner}</td>
                      <td data-label="Stage">{item.stage.replaceAll("_", " ")}</td>
                      <td data-label="Status"><StatusBadge color={item.status_color}>{item.status.replaceAll("_", " ")}</StatusBadge></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
