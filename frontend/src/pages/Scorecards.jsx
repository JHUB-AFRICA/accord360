import { Activity, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { listScorecards, recalculateScorecard } from "../lib/backend.js";

export default function Scorecards() {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const canRecalculate = ["me", "linkages", "director_linkages"].includes(user?.role);

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      setRecords(await listScorecards());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const recalculate = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const current = await listScorecards();
      setRecords(canRecalculate ? await Promise.all(current.map((item) => recalculateScorecard(item.agreement_id))) : current);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshing(false);
    }
  }, [canRecalculate]);

  useEffect(() => { load(); }, [load]);

  if (error && !records) return <><PageHeader eyebrow="Partnership performance" title="Collaboration scorecards" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading persisted scorecards" />;

  return <>
    <PageHeader eyebrow="Partnership performance" title="Collaboration scorecards" actions={<button className="secondary-button" disabled={refreshing} onClick={recalculate}><RefreshCw size={17} /> {refreshing ? "Updating…" : canRecalculate ? "Recalculate scorecards" : "Refresh scorecards"}</button>} meta={<span className="scope-note"><ShieldCheck size={15} /> Versioned weights total 100%</span>} />
    <div className="inline-alert info"><Gauge size={18} /><div><strong>Persisted scorecards</strong><p>Each score is a dated snapshot of the agreement data and scorecard definition used.</p></div></div>
    <section className="scorecard-grid">{records.length ? records.map((item) => { const score = item.snapshot; return <article className="panel scorecard-card" key={item.agreement_id}><div className="scorecard-head"><div><span className="section-kicker">{item.reference_number}</span><h2>{item.title}</h2><p>{item.partner_name} · {item.agreement_type}</p></div><div className="score-ring"><strong>{score.overall}</strong><span>/100</span></div></div><StatusBadge tone={score.overall >= 80 ? "green" : score.overall >= 60 ? "blue" : score.overall >= 40 ? "orange" : "red"}>{score.category}</StatusBadge><div className="score-components">{score.components.map((component) => <div key={component.name}><div><span>{component.name}</span><strong>{component.score}% · {component.weight}% weight</strong></div><div className="progress-track"><span style={{ width: `${component.score}%` }} /></div></div>)}</div><div className="score-source"><Activity size={16} /> Snapshot from {new Date(score.created_at).toLocaleString()}.</div></article>; }) : <section className="panel empty-state"><Gauge size={30} /><h2>No active agreements available</h2><p>Persisted scorecards appear here when active agreements are in your authorized scope.</p></section>}</section>
  </>;
}
