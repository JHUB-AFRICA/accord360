import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileWarning,
  Handshake,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target
} from "lucide-react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageHeader from "../components/PageHeader";
import SlaBadge from "../components/SlaBadge";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const stageColors = ["#0f766e", "#0f766e", "#0f766e", "#c6a45d", "#0f766e", "#0f766e", "#d97706", "#64748b"];

function KpiCard({ label, value, note, icon: Icon, tone }) {
  return (
    <div className={`kpi-card kpi-${tone}`}>
      <div className="kpi-top"><span>{label}</span><div className="kpi-icon"><Icon size={20} /></div></div>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

function GuardrailCard({ item }) {
  return (
    <div className={`guardrail-card guardrail-${item.level}`}>
      <div className="guardrail-dot" />
      <div><strong>{item.label}</strong><span>{item.rule}</span></div>
      <b>{item.value}</b>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState("");
  const [agreementType, setAgreementType] = useState("");

  async function load() {
    setLoading(true);
    const query = new URLSearchParams();
    if (department) query.set("department", department);
    if (agreementType) query.set("agreement_type", agreementType);
    try {
      setData(await api(`/dashboard/stats?${query}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [department, agreementType]);

  if (loading || !data) return <div className="panel page-loading"><RefreshCw className="spin" /> Loading dashboard...</div>;

  const { kpis, role_context: context, me_summary: meSummary } = data;
  const canCreate = ["researcher", "linkages", "admin"].includes(user?.role);
  const canFilter = ["linkages", "executive", "admin", "auditor"].includes(user?.role);

  return (
    <>
      <PageHeader
        eyebrow="Role-specific command centre"
        title={context.title}
        description={context.subtitle}
        actions={canCreate ? <Link className="primary-button" to="/agreements/new"><Plus size={18} /> New request</Link> : null}
      />

      {canFilter && (
        <div className="panel dashboard-filter-bar">
          <div><strong>Portfolio filters</strong><span>All metrics and drill-downs use the selected scope.</span></div>
          <label>Department<select value={department} onChange={(e) => setDepartment(e.target.value)}><option value="">All departments</option>{data.filters.departments.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Agreement type<select value={agreementType} onChange={(e) => setAgreementType(e.target.value)}><option value="">All types</option>{data.filters.agreement_types.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
      )}

      <section className="kpi-grid">
        <KpiCard label="Active partnerships" value={kpis.active_partnerships} note="Signed, operational and unexpired" icon={Handshake} tone="green" />
        <KpiCard label="Pipeline volume" value={kpis.pipeline_volume} note="Requests moving through controlled stages" icon={Clock3} tone="blue" />
        <KpiCard label="Dormant / at risk" value={kpis.at_risk} note="Expiry, stagnation or inactivity signals" icon={FileWarning} tone="orange" />
        <KpiCard label="Resource value generated" value={`KES ${Number(kpis.total_value).toLocaleString()}`} note="Approved grants, projects and contributions" icon={CircleDollarSign} tone="purple" />
      </section>

      <section className="dashboard-grid dashboard-grid-main">
        <div className="panel chart-panel span-2">
          <div className="panel-head"><div><h3>Lifecycle distribution</h3><p>Real-time flow through all eight controlled stages</p></div><span className="panel-chip">Drill-down ready</span></div>
          <div className="chart-height chart-height-wide">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_stage} margin={{ top: 20, right: 10, left: -20, bottom: 55 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-28} textAnchor="end" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={30}>
                  {data.by_stage.map((entry, index) => <Cell key={entry.key} fill={stageColors[index]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel guardrail-panel">
          <div className="panel-head"><div><h3>Automated guardrails</h3><p>Risk logic applied to the live portfolio</p></div><ShieldCheck size={20} /></div>
          <div className="guardrail-list">{data.guardrails.map((item) => <GuardrailCard key={item.key} item={item} />)}</div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel chart-panel">
          <div className="panel-head"><div><h3>Pipeline trend</h3><p>Requests created during the last six months</p></div></div>
          <div className="chart-height">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthly_pipeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs><linearGradient id="pipelineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={0.32} /><stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                <Area type="monotone" dataKey="count" stroke="#0f766e" strokeWidth={3} fill="url(#pipelineFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel me-summary-panel">
          <div className="panel-head"><div><h3>M&E accountability</h3><p>Targets, actuals, evidence and dormancy</p></div><Target size={20} /></div>
          <div className="me-summary-grid">
            <div><FileCheck2 size={18} /><span>Deliverables</span><strong>{meSummary.deliverables}</strong></div>
            <div><Target size={18} /><span>Attainment</span><strong>{meSummary.attainment_percent}%</strong></div>
            <div><ShieldCheck size={18} /><span>Evidence</span><strong>{meSummary.evidence_documents}</strong></div>
            <div><AlertTriangle size={18} /><span>Dormant</span><strong>{meSummary.dormant_agreements}</strong></div>
          </div>
          {["admin", "linkages", "me", "executive", "auditor"].includes(user?.role) && <Link className="secondary-button full-button" to="/monitoring">Open M&E workspace <ArrowRight size={16} /></Link>}
        </div>

        <div className="panel priority-panel">
          <div className="panel-head"><div><h3>{context.queue_label}</h3><p>Role-owned tasks and escalations</p></div><Link to="/work" className="text-link">View queue <ArrowRight size={15} /></Link></div>
          {data.priority_queue.length === 0 ? <div className="queue-clear"><ShieldCheck size={28} /><strong>Queue clear</strong><span>No priority actions are currently due.</span></div> : <div className="priority-list">{data.priority_queue.slice(0, 4).map((item) => (
            <Link className="priority-row" to={`/agreements/${item.id}`} key={item.id}>
              <span className={`priority-indicator level-${item.status_color}`} />
              <div><strong>{item.title}</strong><span>{item.next_action || item.stage.replaceAll("_", " ")}</span></div>
              <SlaBadge state={item.sla_state} days={item.days_in_stage} />
            </Link>
          ))}</div>}
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="panel-head"><div><h3>Recent agreements</h3><p>Most recently updated records in your authorized scope</p></div><Link to="/agreements" className="text-link">View all <ArrowRight size={15} /></Link></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Agreement</th><th>Partner</th><th>Stage</th><th>Status</th></tr></thead>
            <tbody>{data.recent_agreements.map((item) => (
              <tr key={item.id}>
                <td data-label="Agreement"><Link className="table-title" to={`/agreements/${item.id}`}>{item.title}</Link><span>{item.reference_number}</span></td>
                <td data-label="Partner">{item.partner}</td>
                <td data-label="Stage">{item.stage.replaceAll("_", " ")}</td>
                <td data-label="Status"><StatusBadge color={item.status_color}>{item.status.replaceAll("_", " ")}</StatusBadge></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
