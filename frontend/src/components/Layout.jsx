import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Bell, BookOpen, Building2, ChevronDown, ClipboardCheck, ClipboardList,
  FileBarChart, FileCheck2, FileSignature, FileText, Gauge, Gavel, HelpCircle, History,
  LogOut, Menu, MonitorCheck, PlusCircle, Scale, Search, Settings, ShieldCheck, UserCheck,
  Users, X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listNotifications, markNotificationRead } from "../lib/backend.js";
import { initials } from "../lib/format";
import { roleConfig } from "../lib/roles";
import StatusBadge from "./StatusBadge";

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
  templates: BookOpen
};

const navigation = {
  researcher: [
    ["home", "Dashboard", "/researcher"],
    ["new", "Create request", "/agreements/new"],
    ["agreements", "My requests", "/agreements"],
    ["corrections", "Corrections", "/corrections"],
    ["monitoring", "Six-month reports", "/monitoring"],
    ["notifications", "Notifications", "/notifications"],
    ["help", "Help", "/help"]
  ],
  approver: [
    ["home", "Dashboard", "/approvals"],
    ["approvals", "Approval queue", "/approvals/queue"],
    ["agreements", "Faculty agreements", "/agreements"],
    ["corrections", "Returned requests", "/corrections"],
    ["notifications", "Notifications", "/notifications"]
  ],
  linkages: [
    ["home", "Dashboard", "/linkages"],
    ["verification", "Partner verification", "/partners?status=under_review"],
    ["partners", "Partner registry", "/partners"],
    ["approvals", "Linkages review queue", "/linkages/queue"],
    ["agreements", "Agreement lifecycle", "/agreements"],
    ["corrections", "Corrections", "/corrections"],
    ["monitoring", "M&E reports", "/monitoring"],
    ["notifications", "Notifications", "/notifications"],
    ["reports", "Reports", "/reports"]
  ],
  director_linkages: [
    ["home", "Directorate dashboard", "/director"],
    ["agreements", "Portfolio", "/agreements"],
    ["partners", "Partners", "/partners"],
    ["corrections", "Escalations", "/corrections"],
    ["monitoring", "M&E & scorecards", "/monitoring"],
    ["reports", "Reports", "/reports"],
    ["audit", "Audit trail", "/audit"]
  ],
  legal: [
    ["home", "Legal dashboard", "/legal"],
    ["legal", "Review queue", "/legal/queue"],
    ["corrections", "Returned drafts", "/corrections"],
    ["agreements", "Legal-approved packages", "/agreements?stage=dvc_approval"],
    ["notifications", "Notifications", "/notifications"]
  ],
  dvc: [
    ["home", "DVC dashboard", "/dvc"],
    ["dvc", "Endorsement queue", "/dvc/queue"],
    ["agreements", "Endorsed packages", "/agreements?stage=vc_submission"],
    ["notifications", "Notifications", "/notifications"]
  ],
  vc_office: [
    ["home", "VC dashboard", "/signing"],
    ["signing", "Submission packages", "/signing/queue"],
    ["agreements", "Executed agreements", "/agreements?stage=active"],
    ["notifications", "Notifications", "/notifications"]
  ],
  me: [
    ["home", "M&E dashboard", "/monitoring"],
    ["monitoring", "Six-month reports", "/monitoring/reports"],
    ["scorecards", "Scorecards", "/scorecards"],
    ["agreements", "Active agreements", "/agreements?stage=active"],
    ["notifications", "Notifications", "/notifications"],
    ["reports", "Performance reports", "/reports"]
  ],
  executive: [
    ["home", "Executive dashboard", "/executive"],
    ["agreements", "Partnership portfolio", "/agreements"],
    ["scorecards", "Scorecards", "/scorecards"],
    ["reports", "Executive reports", "/reports"],
    ["audit", "Audit summary", "/audit"]
  ],
  admin: [
    ["home", "Administration", "/admin"],
    ["users", "Users & roles", "/users"],
    ["settings", "Configuration", "/configuration"],
    ["templates", "Templates", "/configuration?tab=templates"],
    ["audit", "Audit log", "/audit"],
    ["help", "Help", "/help"]
  ],
  auditor: [
    ["home", "Compliance dashboard", "/audit-workspace"],
    ["agreements", "Authorized records", "/agreements"],
    ["reports", "Compliance reports", "/reports"],
    ["audit", "Audit trail", "/audit"]
  ]
};

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const { user, logout, isMockMode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const config = roleConfig(user?.role);

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    let active = true;
    listNotifications().then((items) => { if (active) setNotifications(items); }).catch(() => {});
    return () => { active = false; };
  }, [location.pathname]);

  const nav = useMemo(() => (navigation[user?.role] || []).map(([key, label, to]) => ({ key, label, to, icon: iconMap[key] || FileText })), [user?.role]);
  const unread = notifications.filter((item) => !item.is_read).length;

  async function markRead(item) {
    if (!item.is_read) {
      await markNotificationRead(item.id);
      setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, is_read: true } : notification));
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">Skip to main content</a>
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`} aria-label="Workspace navigation">
        <div className="brand-block">
          <div className="brand-mark">A</div>
          <div><strong>Accord360</strong><span>Directorate of Linkages (RPE)</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <div className="workspace-chip">
          <div className="workspace-icon"><FileText size={18} /></div>
          <div><span>Workspace</span><strong>{config.label}</strong></div>
          <ChevronDown size={16} aria-hidden="true" />
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
          <form className="global-search" role="search" onSubmit={(event) => { event.preventDefault(); const query = globalSearch.trim(); if (query) navigate(`/agreements?search=${encodeURIComponent(query)}`); }}>
            <Search size={18} aria-hidden="true" />
            <input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} aria-label="Search agreements and partners" placeholder="Search reference, agreement or partner…" />
          </form>
          <div className="topbar-actions">
            {isMockMode && <StatusBadge tone="blue">Demo mode</StatusBadge>}
            <div className="notification-wrap">
              <button className="icon-button notification-button" onClick={() => setShowNotifications((value) => !value)} aria-expanded={showNotifications} aria-label={`${unread} unread notifications`}><Bell size={20} />{unread > 0 && <span>{unread}</span>}</button>
              {showNotifications && (
                <div className="notification-popover">
                  <div className="popover-head"><div><strong>Notifications</strong><span>{unread} unread</span></div><Link to="/notifications" onClick={() => setShowNotifications(false)}>View all</Link></div>
                  <div className="popover-list">
                    {notifications.slice(0, 5).map((item) => (
                      <Link key={item.id} to={item.link || "/notifications"} className={`popover-notification ${item.is_read ? "read" : ""}`} onClick={() => { markRead(item); setShowNotifications(false); }}>
                        <span className={`priority-dot priority-${item.priority}`} />
                        <div><strong>{item.title}</strong><span>{item.record_reference}</span><small>{item.required_action}</small></div>
                      </Link>
                    ))}
                    {!notifications.length && <div className="popover-empty">No notifications.</div>}
                  </div>
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
