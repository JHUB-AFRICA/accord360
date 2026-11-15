import { BellRing, CheckCheck, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { useNotifications } from "../context/NotificationContext.jsx";
import { formatDateTime } from "../lib/format.js";

export default function Notifications() {
  const { items, unreadCount, loading, error, markRead, markUnread, markAllRead, nextCursor, refresh } = useNotifications();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => items.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [item.title, item.message, item.actor_name, item.agreement_title]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesFilter = filter === "all" || (filter === "unread" && !item.is_read) || (filter === "action_required" && item.requires_action && !item.resolved_at);
    return matchesSearch && matchesFilter;
  }), [items, search, filter]);

  async function changeRead(item) {
    try { await (item.is_read ? markUnread(item.id) : markRead(item.id)); setMessage(item.is_read ? "Notification marked unread." : "Notification marked read."); }
    catch { /* provider retains visible error and rolls back */ }
  }

  async function readAll() {
    try { await markAllRead(); setMessage("All notifications marked read."); }
    catch { /* provider retains visible error and rolls back */ }
  }

  if (loading && !items.length) return <LoadingState label="Loading your latest notifications" />;
  if (error && !items.length) return <><PageHeader eyebrow="Notifications" title="My notifications" /><ErrorState message={error} onRetry={() => refresh()} /></>;

  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => {}} />
    <PageHeader eyebrow="Notifications" title="My notifications" meta={<span className="scope-note"><BellRing size={15} /> {unreadCount} unread</span>} actions={<button className="secondary-button" onClick={readAll} disabled={!unreadCount}><CheckCheck size={16} /> Mark all read</button>} />
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input aria-label="Search notifications" placeholder="Search notifications…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="notification-tabs" role="tablist" aria-label="Notification filters">{[["action_required", "Action required"], ["unread", "Unread"], ["all", "All"]].map(([value, label]) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div></section>
    <section className="notification-list" aria-live="polite">{filtered.length ? filtered.map((item) => <article className={`notification-card ${item.is_read ? "read" : "unread"} ${item.resolved_at ? "resolved" : ""}`} key={item.id}><div className={`notification-indicator tone-${item.priority}`} aria-hidden="true"><BellRing size={19} /></div><div className="notification-content"><div className="notification-title-row"><h2>{item.title}</h2><StatusBadge tone={item.resolved_at ? "slate" : item.is_read ? "slate" : "blue"}>{item.resolved_at ? "Resolved" : item.is_read ? "Read" : "Unread"}</StatusBadge></div><p>{item.message}</p><div className="notification-meta"><span>{item.agreement_title || "System"}</span><span>{item.actor_name}</span><span>{formatDateTime(item.created_at)}</span></div><div className="notification-actions">{item.action_url && <Link className="text-link" to={item.action_url}>{item.requires_action && !item.resolved_at ? "Open task" : "View agreement"}</Link>}<button className="text-button" onClick={() => changeRead(item)}>{item.is_read ? "Mark unread" : "Mark as read"}</button></div></div></article>) : <div className="panel empty-state"><BellRing size={28} /><h2>No notifications match this view</h2><p>Try another tab or search.</p></div>}</section>
    {nextCursor && <button className="secondary-button notification-load-more" onClick={() => refresh({ append: true })}>Load more</button>}
  </>;
}
