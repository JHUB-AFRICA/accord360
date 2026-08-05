import { CheckCircle2, Gauge, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";

export default function Scorecards() {
  const { user } = useAuth();
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const load = useCallback(() => { setError(""); api("/scorecards").then(setRecords).catch((requestError) => setError(requestError.message)); }, []);
  useEffect(() => { load(); }, [load]);
  if (error && !records) return <><PageHeader eyebrow="Partnership performance" title="Collaboration scorecards" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading collaboration scorecards" />;
  async function recalculate(record) {
    setSubmitting(true); setError("");
    try {
      const updated = await api(`/scorecards/${record.id}/recalculate`, { method: "POST" });
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage("Scorecard recalculated using the active 100% weight configuration.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }
  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Partnership performance" title="Collaboration scorecards" description="Weighted scorecards combine Champion, Linkages and automated system inputs. Executives view but do not alter operational scores." />
    <div className="scorecard-stack">{records.map((record) => { const totalWeight = record.components.reduce((sum, item) => sum + Number(item.weight), 0); return <section className="panel scorecard" key={record.id}><div className="scorecard-head"><div><span className="section-kicker">{record.agreement_reference}</span><h2>{record.title}</h2><p>{record.partner_name}</p></div><div className="score-gauge"><strong>{record.overall_score}</strong><span>/100</span><StatusBadge tone="green">{record.category}</StatusBadge></div></div><div className="scorecard-grid"><div><div className="panel-head"><div><h3>Component breakdown</h3><p>Weighted inputs from verified system records</p></div><StatusBadge tone={totalWeight === 100 ? "green" : "red"}>{totalWeight}% total weight</StatusBadge></div><div className="score-components">{record.components.map((component) => <article key={component.key}><div><strong>{component.label}</strong><span>{component.source}</span></div><div className="component-score"><div><span style={{ width: `${component.score}%` }} /></div><b>{component.score}</b><small>{component.weight}% weight</small></div></article>)}</div></div><aside><h3>Score history</h3><div className="score-history-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={record.history}><CartesianGrid strokeDasharray="4 4" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="score" fill="#1b5e3b" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div><dl className="aside-summary"><div><dt>Configuration version</dt><dd>{record.configuration_version}</dd></div><div><dt>Calculation date</dt><dd>{formatDate(record.calculation_date)}</dd></div><div><dt>Reviewer</dt><dd>{record.reviewer}</dd></div></dl>{["me", "linkages", "director_linkages"].includes(user.role) && <button className="secondary-button full-button" disabled={submitting || totalWeight !== 100} onClick={() => recalculate(record)}><RefreshCw size={17} /> Recalculate score</button>}</aside></div><div className="scorecard-footer"><CheckCircle2 /><span>Every component shows its data source, configuration version, reviewer and calculation history.</span></div></section>; })}</div>
  </>;
}
