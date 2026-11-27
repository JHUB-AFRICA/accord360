import { Activity, AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import KpiCard from "../components/KpiCard.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { listAgreements, listProgressSubmissions, transitionAgreement } from "../lib/backend.js";
import { formatDate, humanize } from "../lib/format.js";

// M&E's workspace (REBUILD_BRIEF.md Section 5.1): all agreements' status/
// progress/expiry, a read-only progress-update view, and Update/Archive
// actions that only render on agreements in the "expired" status.
export default function Monitoring() {
  const [records, setRecords] = useState(null);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError("");
    try {
      const [agreements, updates] = await Promise.all([listAgreements(), listProgressSubmissions()]);
      setRecords(agreements);
      setProgressUpdates(updates);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(item, action) {
    setBusyId(item.id);
    setError("");
    try {
      await transitionAgreement(item.id, action);
      setMessage(action === "archive" ? `${item.title} archived.` : `${item.title} moved back into an active flow for renewal.`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => (records || []).filter((item) => {
    const query = search.trim().toLowerCase();
    return !query || [item.title, item.partner_name, item.department, item.status]
      .some((value) => String(value || "").toLowerCase().includes(query));
  }), [records, search]);

  const columns = useMemo(() => [
    { key: "title", label: "Agreement", render: (item) => <div className="stacked-cell"><strong>{item.title}</strong><span>{item.partner_name}</span></div> },
    { key: "department", label: "Department" },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status}>{humanize(item.status)}</StatusBadge> },
    { key: "end_date", label: "End date", render: (item) => formatDate(item.end_date) },
    { key: "days_to_expiry", label: "Days to expiry", render: (item) => item.days_to_expiry ?? "—" },
    {
      key: "action",
      label: "Action",
      render: (item) => item.status === "expired"
        ? <div className="inline-actions">
            <button className="secondary-button compact-button" disabled={busyId === item.id} onClick={(event) => { event.stopPropagation(); act(item, "renew"); }}>Update</button>
            <button className="danger-button compact-button" disabled={busyId === item.id} onClick={(event) => { event.stopPropagation(); act(item, "archive"); }}>Archive</button>
          </div>
        : <span className="wrap-cell">{humanize(item.status)}</span>
    }
  ], [busyId]);

  if (error && !records) return <><PageHeader eyebrow="Monitoring & evaluation" title="Partnership performance" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading agreements for monitoring" />;

  const fullyExecuted = records.filter((item) => item.status === "fully_executed").length;
  const expiredCount = records.filter((item) => item.status === "expired").length;
  const expiringSoon = records.filter((item) => item.status === "fully_executed" && Number.isFinite(item.days_to_expiry) && item.days_to_expiry <= 183).length;

  return <>
    <Toast message={message} onClose={() => setMessage("")} />
    <Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Monitoring & evaluation" title="Partnership performance workspace" description="Every agreement's status and quarterly progress updates, with Update/Archive available once an agreement has expired." />
    <section className="kpi-grid"><KpiCard label="Fully executed" value={fullyExecuted} tone="green" icon={Activity} /><KpiCard label="Expired, needs a decision" value={expiredCount} tone="orange" icon={AlertTriangle} /><KpiCard label="Expiring within 183 days" value={expiringSoon} tone="red" icon={CalendarClock} /><KpiCard label="Total agreements" value={records.length} tone="blue" icon={CheckCircle2} /></section>
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input aria-label="Search monitoring records" placeholder="Search title, partner or department…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></section>
    <section className="panel data-panel"><DataTable columns={columns} rows={filtered} onRowClick={(item) => navigate(`/agreements/${item.id}`)} emptyTitle="No agreements available for monitoring" emptyText="Agreements will appear here as they move through the workflow." /></section>
    <section className="panel data-panel">
      <div className="panel-head"><div><h2>Quarterly progress updates</h2><p>Read-only submissions from Researchers on fully executed or expired agreements.</p></div></div>
      {progressUpdates.length
        ? <div className="activity-timeline">{progressUpdates.map((item) => <article key={item.id}><span className="timeline-dot" /><div><strong>{item.reporting_period} · Submission {item.sequence_number}</strong><p>{item.note || "Progress Sheet submitted for review."}</p><small>{item.submitted_by?.full_name || "Unknown"} · {formatDate(item.submitted_at)}</small></div></article>)}</div>
        : <p className="empty-state">No progress submissions have been submitted yet.</p>}
    </section>
  </>;
}
