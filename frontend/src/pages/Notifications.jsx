import { Bell, CheckCircle2, ExternalLink, MailCheck, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";

export default function Notifications() {
  const [records, setRecords] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(() => { setError(""); api("/notifications").then(setRecords).catch((requestError) => setError(requestError.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => (records || []).filter((item) => {
    const matchesFilter = filter === "all" || filter === "unread" && !item.is_read || filter === "action" && item.required_action !== "No action required" || filter === item.priority;
    const matchesSearch = !search || [item.title, item.record_reference, item.required_action].some((value) => String(value).toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  }), [records, filter, search]);
  async function markRead(item) {
    if (item.is_read) return;
    try { await api(`/notifications/${item.id}/read`, { method: "POST" }); setRecords((current) => current.map((record) => record.id === item.id ? { ...record, is_read: true } : record)); }
    catch (requestError) { setError(requestError.message); }
  }
  async function resendEmail(item) {
    try {
      const updated = await api(`/notifications/${item.id}/resend`, { method: "POST" });
      setRecords((current) => current.map((record) => record.id === updated.id ? updated : record));
      setMessage("Notification email queued for delivery.");
    } catch (requestError) { setError(requestError.message); }
  }
  if (error && !records) return <><PageHeader eyebrow="Notifications" title="Action and reminder centre" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading notifications" />;
  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Notifications" title="Action and reminder centre" description="Every notification identifies the record, sender, required action, due date and direct task link." />
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input placeholder="Search notification or record reference…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="filter-pills">{["all", "unread", "action", "critical", "high"].map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value}</button>)}</div></section>
    <section className="notification-page-list">{filtered.map((item) => <article className={`panel notification-card ${item.is_read ? "read" : "unread"}`} key={item.id}><span className={`notification-card-icon priority-${item.priority}`}><Bell /></span><div className="notification-card-copy"><div><h2>{item.title}</h2><StatusBadge tone={item.priority === "critical" ? "red" : item.priority === "high" ? "orange" : "blue"}>{item.priority}</StatusBadge></div><p>{item.required_action}</p><dl><div><dt>Record</dt><dd>{item.record_reference}</dd></div><div><dt>Sender</dt><dd>{item.sender}</dd></div><div><dt>Due</dt><dd>{item.due_date}</dd></div><div><dt>Created</dt><dd>{formatDateTime(item.created_at)}</dd></div></dl><div className="notification-meta"><span><MailCheck size={15} /> Email {item.email_status}</span><span>Escalation level {item.escalation_level}</span></div></div><div className="notification-card-actions"><Link className="primary-button compact-button" to={item.link} onClick={() => markRead(item)}>View action <ExternalLink size={15} /></Link>{!item.is_read && <button className="text-button" onClick={() => markRead(item)}><CheckCircle2 size={15} /> Mark read</button>}<button className="text-button" onClick={() => resendEmail(item)}>Resend email</button></div></article>)}{!filtered.length && <div className="panel inline-empty"><CheckCircle2 /> No notifications match this view.</div>}</section>
  </>;
}
