import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, RefreshCw, Target } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { api } from "../lib/api";

export default function Monitoring() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/monitoring/portfolio").then(setRows).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const deliverables = rows.reduce((sum, row) => sum + row.deliverable_count, 0);
    const evidence = rows.reduce((sum, row) => sum + row.evidence_count, 0);
    const dormant = rows.filter((row) => row.days_since_update !== null && row.days_since_update >= 180).length;
    const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.attainment_percent, 0) / rows.length) : 0;
    return { deliverables, evidence, dormant, average };
  }, [rows]);

  if (loading) return <div className="panel page-loading"><RefreshCw className="spin" /> Loading M&E portfolio...</div>;

  return (
    <>
      <PageHeader eyebrow="Monitoring and evaluation" title="Partnership performance" description="Track targets, actual outputs, evidence, update discipline and implementation risk across active agreements." />
      <section className="kpi-grid me-kpi-grid">
        <div className="kpi-card kpi-green"><div className="kpi-top"><span>Active M&E records</span><div className="kpi-icon"><Target size={20} /></div></div><strong>{rows.length}</strong><p>Active partnerships under monitoring</p></div>
        <div className="kpi-card kpi-blue"><div className="kpi-top"><span>Deliverables</span><div className="kpi-icon"><CheckCircle2 size={20} /></div></div><strong>{summary.deliverables}</strong><p>Targets and actual outputs recorded</p></div>
        <div className="kpi-card kpi-purple"><div className="kpi-top"><span>Evidence records</span><div className="kpi-icon"><FileCheck2 size={20} /></div></div><strong>{summary.evidence}</strong><p>Uploaded implementation evidence</p></div>
        <div className="kpi-card kpi-orange"><div className="kpi-top"><span>Dormancy risk</span><div className="kpi-icon"><AlertTriangle size={20} /></div></div><strong>{summary.dormant}</strong><p>No output update for 180 days</p></div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h3>Active agreement performance</h3><p>Target attainment, evidence availability, ownership and last update status.</p></div><span className="panel-chip">Average attainment {summary.average}%</span></div>
        {error ? <div className="form-error">{error}</div> : rows.length === 0 ? <EmptyState title="No active agreements" text="M&E records become available after an agreement is signed and activated." /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Agreement</th><th>Champion</th><th>Attainment</th><th>Evidence</th><th>Last update</th><th>Risk</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Agreement"><Link className="table-title" to={`/agreements/${row.id}`}>{row.title}</Link><span>{row.reference_number} · {row.partner}</span></td>
                  <td data-label="Champion">{row.internal_champion || "Not assigned"}<span>{row.partner_liaison || "Partner liaison missing"}</span></td>
                  <td data-label="Attainment"><div className="attainment-cell"><div><span style={{ width: `${Math.min(100, row.attainment_percent)}%` }} /></div><strong>{row.attainment_percent}%</strong></div></td>
                  <td data-label="Evidence">{row.evidence_count} file{row.evidence_count === 1 ? "" : "s"}</td>
                  <td data-label="Last update">{row.days_since_update === null ? "No update" : `${row.days_since_update} days ago`}</td>
                  <td data-label="Risk"><StatusBadge color={row.risk_level}>{row.risk_level === "red" ? "attention required" : "healthy"}</StatusBadge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
