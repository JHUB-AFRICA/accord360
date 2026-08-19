import { BellRing, CheckCheck, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { listNotifications, markNotificationRead } from "../lib/backend.js";
import { formatDateTime } from "../lib/format.js";

export default function Notifications() {
  const [records, setRecords] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try { setRecords(await listNotifications()); }
    catch (requestError) { setError(requestError.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (records || []).filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [item.title, item.message, item.required_action, item.record_reference]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesFilter = filter === "all" || (filter === "unread" ? !item.is_read : item.priority === filter);
    return matchesSearch && matchesFilter;
  }), [records, search, filter]);

  async function markRead(item) {
    if (item.is_read) return;
    setError("");
    try {
      const updated = await markNotificationRead(item.id);
      setRecords((current) => current.map((record) => record.id === item.id ? updated : record));
      setMessage("Notification marked as read.");
    } catch (requestError) { setError(requestError.message); }
  }

  if (error && !records) return <><PageHeader eyebrow="Notifications" title="My notifications" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading your latest notifications" />;

  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Notifications" title="My notifications" description="The backend returns the authenticated user's latest 50 notifications. Supported actions are viewing the related agreement and marking an item as read." meta={<span className="scope-note"><BellRing size={15} /> {records.filter((item) => !item.is_read).length} unread</span>} />
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input aria-label="Search notifications" placeholder="Search notifications…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Filter notifications" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All notifications</option><option value="unread">Unread</option><option value="critical">Critical</option><option value="high">High priority</option><option value="normal">Normal</option></select></section>
    <section className="notification-list">{filtered.length ? filtered.map((item) => <article className={`notification-card ${item.is_read ? "read" : "unread"}`} key={item.id}><div className={`notification-indicator tone-${item.priority === "critical" ? "red" : item.priority === "high" ? "orange" : "blue"}`}><BellRing size={19} /></div><div className="notification-content"><div className="notification-title-row"><h2>{item.title}</h2><StatusBadge tone={item.is_read ? "slate" : "blue"}>{item.is_read ? "Read" : "Unread"}</StatusBadge></div><p>{item.message}</p><div className="notification-meta"><span>{item.record_reference}</span><span>{formatDateTime(item.created_at)}</span></div><div className="notification-actions">{item.agreement_id && <Link className="text-link" to={`/agreements/${item.agreement_id}`}>View agreement</Link>}{!item.is_read && <button className="text-button" onClick={() => markRead(item)}><CheckCheck size={16} /> Mark as read</button>}</div></div></article>) : <div className="panel empty-state"><BellRing size={28} /><h2>No notifications match this view</h2><p>Try another search or filter.</p></div>}</section>
  </>;
}
