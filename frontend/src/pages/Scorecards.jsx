import { Activity, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { getAgreement, listAgreements } from "../lib/backend.js";
import { calculateAgreementScore } from "../lib/normalize.js";

export default function Scorecards() {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const active = await listAgreements({ stage: "active" });
      const details = await Promise.all(active.map((item) => getAgreement(item.id)));
      setRecords(details.map((agreement) => ({ agreement, score: calculateAgreementScore(agreement) })));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error && !records) return <><PageHeader eyebrow="Partnership performance" title="Collaboration scorecards" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Calculating score previews from agreement data" />;

  return <>
    <PageHeader eyebrow="Partnership performance" title="Collaboration scorecards" description="Scores are transparent frontend previews calculated from implemented deliverable, evidence, risk and value fields. No scorecard records are persisted because the backend has no scorecard endpoint." actions={<button className="secondary-button" disabled={refreshing} onClick={load}><RefreshCw size={17} /> {refreshing ? "Refreshing…" : "Recalculate previews"}</button>} meta={<span className="scope-note"><ShieldCheck size={15} /> Weight total 100%</span>} />
    <div className="inline-alert info"><Gauge size={18} /><div><strong>Calculation only</strong><p>These values support review and UI testing. They are not official institutional scores until the backend provides a governed scoring model and persistence.</p></div></div>
    <section className="scorecard-grid">{records.length ? records.map(({ agreement, score }) => <article className="panel scorecard-card" key={agreement.id}><div className="scorecard-head"><div><span className="section-kicker">{agreement.reference}</span><h2>{agreement.title}</h2><p>{agreement.partner_name} · {agreement.agreement_type}</p></div><div className="score-ring"><strong>{score.overall}</strong><span>/100</span></div></div><StatusBadge tone={score.overall >= 80 ? "green" : score.overall >= 60 ? "blue" : score.overall >= 40 ? "orange" : "red"}>{score.category}</StatusBadge><div className="score-components">{score.components.map((component) => <div key={component.name}><div><span>{component.name}</span><strong>{component.score}% · {component.weight}% weight</strong></div><div className="progress-track"><span style={{ width: `${component.score}%` }} /></div></div>)}</div><div className="score-source"><Activity size={16} /> Based on current deliverables, evidence IDs, status color and value records.</div></article>) : <section className="panel empty-state"><Gauge size={30} /><h2>No active agreements available</h2><p>Score previews require active agreements with backend-visible details.</p></section>}</section>
  </>;
}
