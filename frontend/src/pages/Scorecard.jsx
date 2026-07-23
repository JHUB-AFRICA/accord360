import { useEffect, useMemo, useState } from "react";
import { Download, Pencil, RefreshCw, Save, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

export default function Scorecard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [qual, setQual] = useState(null); // { id, score, note }

  async function load() { setData(await api("/scorecard")); }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  const canScore = ["admin", "linkages", "me"].includes(user?.role);

  async function saveQualitative(e) {
    e.preventDefault();
    try {
      await api(`/scorecard/${qual.id}/qualitative`, { method: "POST", body: JSON.stringify({ score: Number(qual.score), note: qual.note || null }) });
      setQual(null); setMessage("Qualitative score saved."); await load();
    } catch (err) { setError(err.message); }
  }

  async function exportCsv() {
    const blob = await api("/scorecard/export.csv");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "accord360-scorecard.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const average = useMemo(() => data?.rows?.length ? Math.round(data.rows.reduce((s, r) => s + r.weighted_total, 0) / data.rows.length) : 0, [data]);

  if (!data && !error) return <div className="panel page-loading"><RefreshCw className="spin" /> Loading scorecard…</div>;

  return (
    <>
      <PageHeader
        eyebrow="Partnership performance scorecard"
        title="Weighted scorecard"
        description="Every active partnership scored against the adjustable Appendix B criteria. Weights are configured by the administrator and always total 100%."
        actions={<button className="secondary-button" onClick={exportCsv}><Download size={16} /> Export CSV</button>}
      />
      <Toast message={message} type="success" onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />

      <section className="kpi-grid me-kpi-grid">
        <div className="kpi-card kpi-green"><div className="kpi-top"><span>Scored partnerships</span><div className="kpi-icon"><Trophy size={20} /></div></div><strong>{data?.rows?.length || 0}</strong><p>Active agreements on the scorecard</p></div>
        <div className="kpi-card kpi-blue"><div className="kpi-top"><span>Portfolio average</span><div className="kpi-icon"><Trophy size={20} /></div></div><strong>{average}</strong><p>Mean weighted score</p></div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h3>Criteria and weights</h3><p>Adjustable in the admin console (Settings → Scorecard weights).</p></div></div>
        <div className="weight-strip">
          {data?.criteria?.map((c) => <div key={c.key} className="weight-chip" title={c.description || ""}><strong>{c.weight}%</strong><span>{c.label}</span></div>)}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h3>Active partnership scores</h3><p>Raw criterion scores (0–100) and the weighted total.</p></div></div>
        {!data?.rows?.length ? <EmptyState title="No active agreements to score" text="Scores appear as soon as agreements are activated." /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Agreement</th>{data.criteria.map((c) => <th key={c.key}>{c.label}</th>)}<th>Total</th><th>Grade</th>{canScore && <th />}</tr></thead>
              <tbody>{data.rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Agreement"><Link className="table-title" to={`/agreements/${row.id}`}>{row.title}</Link><span>{row.reference_number} · {row.partner}</span></td>
                  {data.criteria.map((c) => <td key={c.key} data-label={c.label}>{row.scores[c.key]}</td>)}
                  <td data-label="Total"><strong>{row.weighted_total}</strong></td>
                  <td data-label="Grade">{row.grade}{row.qualitative_note ? <span> · {row.qualitative_note}</span> : null}</td>
                  {canScore && <td data-label="Score"><button className="icon-button" title="Set qualitative score" onClick={() => setQual({ id: row.id, score: row.scores.qualitative, note: row.qualitative_note || "" })}><Pencil size={15} /></button></td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {qual && (
          <form className="inline-form" onSubmit={saveQualitative} style={{ marginTop: "1rem" }}>
            <h4>Qualitative assessment (0–100)</h4>
            <input type="number" min="0" max="100" required value={qual.score} onChange={(e) => setQual({ ...qual, score: e.target.value })} />
            <input placeholder="Narrative note" value={qual.note} onChange={(e) => setQual({ ...qual, note: e.target.value })} style={{ minWidth: "260px" }} />
            <button className="primary-button"><Save size={15} /> Save</button>
            <button className="secondary-button" type="button" onClick={() => setQual(null)}>Cancel</button>
          </form>
        )}
      </section>
    </>
  );
}
