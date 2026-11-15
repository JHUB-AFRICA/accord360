import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Bell, BookOpen, Building2, ClipboardCheck, ClipboardList,
  FileBarChart, FileCheck2, FileSignature, FileText, Gauge, Gavel, HelpCircle, History,
  LogOut, Menu, MonitorCheck, PlusCircle, Scale, Search, Settings, ShieldCheck, UserCheck,
  Users, X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext.jsx";
import { initials } from "../lib/format";
import { roleConfig } from "../lib/roles";
import StatusBadge from "./StatusBadge";
import jkuatLogo from "../assets/jkuat-logo.jpg";

const iconMap = {
  home: Gauge,
  agreements: ClipboardList,
  new: PlusCircle,
  corrections: FileCheck2,
  partners: Building2,
  verification: UserCheck,
  approvals: ClipboardCheck,
  legal: Gavel,
  dvc: Scale,
  signing: FileSignature,
  monitoring: MonitorCheck,
  scorecards: BarChart3,
  reports: FileBarChart,
  notifications: Bell,
  users: Users,
  settings: Settings,
  audit: ShieldCheck,
  help: HelpCircle,
  documents: FileText,
  history: History,
  templates: BookOpen,
  review: ClipboardCheck
};

// Navigation entries below were trimmed per REBUILD_BRIEF.md Section 1 to
// drop links to removed pages/routes (data-review, scorecards, users, admin,
// audit) and removed roles (approver, director_linkages, dvc, vc_office,
// executive, admin, auditor). Keyed by the four Section 2.1 roles.
const navigation = {
  researcher: [
    ["home", "My agreements", "/researcher"],
    ["new", "Create new agreement", "/agreements/new"],
    ["notifications", "Notifications", "/notifications"],
    ["help", "Help", "/help"]
  ],
  linkages: [
    ["home", "Dashboard", "/linkages"],
    ["agreements", "All agreements", "/agreements"],
    ["partners", "Partners", "/partners"],
    ["templates", "Templates", "/templates"],
    ["notifications", "Notifications", "/notifications"],
    ["help", "Help", "/help"]
  ],
  legal: [
    ["home", "Legal dashboard", "/legal"],
    ["legal", "Review queue", "/legal/queue"],
    ["agreements", "All agreements", "/agreements"],
    ["notifications", "Notifications", "/notifications"]
  ],
  me: [
    ["home", "M&E dashboard", "/monitoring"],
    ["agreements", "All agreements", "/agreements"],
    ["notifications", "Notifications", "/notifications"],
    ["reports", "Performance reports", "/reports"]
  ]
};

// The topbar search only makes sense on pages you actually browse/search a
// list of agreements from -- not on a create form, a single agreement's own
// detail page, notifications, help, or anywhere else.
const SEARCH_VISIBLE_PATHS = ["/researcher", "/linkages", "/legal", "/monitoring", "/agreements"];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const { user, logout, isMockMode } = useAuth();
  const { items: notifications, unreadCount: unread, error: notificationError, markRead, markAllRead } = useNotifications();
  const notificationButtonRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const config = roleConfig(user?.role);

  useEffect(() => setMobileOpen(false), [location.pathname]);
  const nav = useMemo(() => (navigation[user?.role] || []).map(([key, label, to]) => ({ key, label, to, icon: iconMap[key] || FileText })), [user?.role]);
  const recent = notifications.slice(0, 5);

  useEffect(() => {
    if (!showNotifications) return undefined;
    const onKey = (event) => { if (event.key === "Escape") { setShowNotifications(false); notificationButtonRef.current?.focus(); } };
    const onPointer = (event) => { if (!event.target.closest(".notification-wrap")) setShowNotifications(false); };
    window.addEventListener("keydown", onKey); window.addEventListener("pointerdown", onPointer);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onPointer); };
  }, [showNotifications]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">Skip to main content</a>
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`} aria-label="Workspace navigation">
        <div className="brand-block">
          <div className="brand-mark brand-logo"><img src={jkuatLogo} alt="JKUAT logo" /></div>
          <div><strong>Accord360</strong><span>Directorate of Linkages (RPE)</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <div className="workspace-chip">
          <div className="workspace-icon"><FileText size={18} /></div>
          <div><span>Workspace</span><strong>{config.label}</strong></div>
        </div>

        <nav className="side-nav">
          <span className="nav-label">{config.workspace}</span>
          {nav.map(({ key, label, to, icon: Icon }) => (
            <NavLink key={`${key}-${to}`} to={to} end={key === "home"} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-mini">
            <div className="avatar">{initials(user?.full_name)}</div>
            <div><strong>{user?.full_name}</strong><span>{config.label}</span></div>
          </div>
          <button className="icon-button" onClick={() => logout()} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
        </div>
      </aside>

      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
          <div className="topbar-title"><strong>{config.workspace}</strong><span>{config.shortDescription}</span></div>
          {SEARCH_VISIBLE_PATHS.includes(location.pathname) && <form className="global-search" role="search" onSubmit={(event) => { event.preventDefault(); const query = globalSearch.trim(); if (query) navigate(`/agreements?search=${encodeURIComponent(query)}`); }}>
            <Search size={18} aria-hidden="true" />
            <input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} aria-label="Search agreements and partners" placeholder="Search reference, agreement or partner…" />
          </form>}
          <div className="topbar-actions">
            {isMockMode && <StatusBadge tone="blue">Demo mode</StatusBadge>}
            <div className="notification-wrap">
              <button ref={notificationButtonRef} className="icon-button notification-button" onClick={() => setShowNotifications((value) => !value)} aria-expanded={showNotifications} aria-controls="notification-popover" aria-haspopup="dialog" aria-label={`${unread} unread notifications`}><Bell size={20} />{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}</button>
              {showNotifications && (
                <div id="notification-popover" className="notification-popover" role="dialog" aria-label="Notifications">
                  <div className="popover-head"><div><strong>Notifications</strong><span>{unread} unread</span></div><div className="popover-head-actions"><button className="text-button" onClick={() => void markAllRead().catch(() => {})}>Mark all read</button><Link to="/notifications" onClick={() => setShowNotifications(false)}>View all</Link></div></div>
                  <div className="popover-list">
                    {recent.map((item) => (
                      <Link key={item.id} to={item.action_url || "/notifications"} className={`popover-notification ${item.is_read ? "read" : "unread"}`} onClick={() => { if (!item.is_read) void markRead(item.id).catch(() => {}); setShowNotifications(false); }}>
                        <span aria-hidden="true" className={`priority-dot priority-${item.priority}`} />
                        <div><strong>{item.title}</strong><span>{item.agreement_title || item.category.replace("_", " ")}</span><small>{item.actor_name} · {item.requires_action ? item.message : "Informational update"}</small></div>
                      </Link>
                    ))}
                    {!recent.length && <div className="popover-empty">No notifications yet.</div>}
                  </div>
                  {notificationError && <div className="notification-inline-error" role="alert">{notificationError}</div>}
                </div>
              )}
            </div>
            <Link className="icon-button" to="/help" aria-label="Open help"><HelpCircle size={20} /></Link>
            <div className="topbar-user"><div className="avatar avatar-small">{initials(user?.full_name)}</div><div><strong>{user?.full_name}</strong><span>{user?.department || config.label}</span></div></div>
          </div>
        </header>
        <main id="workspace-main" className="workspace-main"><Outlet /></main>
      </div>
    </div>
  );
}
