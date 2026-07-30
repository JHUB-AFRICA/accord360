import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileSignature,
  FileText,
  Gauge,
  Gavel,
  LogOut,
  Menu,
  MonitorCheck,
  PlusCircle,
  Settings,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { roleConfig } from "../lib/roles";

const iconMap = {
  home: Gauge,
  agreements: ClipboardList,
  new: PlusCircle,
  partners: Building2,
  reports: FileBarChart,
  users: Users,
  audit: ShieldCheck,
  settings: Settings,
  approvals: ClipboardCheck,
  legal: Gavel,
  signing: FileSignature,
  monitoring: MonitorCheck,
  executive: BarChart3
};

const roleNavigation = {
  researcher: [
    ["home", "My workspace"],
    ["agreements", "My agreements"],
    ["new", "New collaboration request"]
  ],
  approver: [
    ["home", "Approval queue"],
    ["agreements", "Department agreements"]
  ],
  linkages: [
    ["home", "Operations workspace"],
    ["agreements", "Agreement lifecycle"],
    ["new", "Log new request"],
    ["partners", "Partner registry"],
    ["reports", "Operational reports"]
  ],
  director_linkages: [
    ["home", "Directorate workspace"],
    ["agreements", "Agreement lifecycle"],
    ["new", "Log new request"],
    ["partners", "Partner registry"],
    ["reports", "Portfolio reports"],
    ["audit", "Audit trail"]
  ],
  legal: [
    ["home", "Legal review queue"],
    ["agreements", "Legal matters"]
  ],
  dvc: [
    ["home", "DVC endorsement queue"],
    ["agreements", "Governance packages"],
    ["reports", "Summary reports"]
  ],
  vc_office: [
    ["home", "VC signing desk"],
    ["agreements", "Signing packages"]
  ],
  me: [
    ["home", "M&E workspace"],
    ["agreements", "Active collaborations"],
    ["reports", "Performance reports"]
  ],
  executive: [
    ["home", "Executive dashboard"],
    ["agreements", "Partnership portfolio"],
    ["reports", "Executive reports"],
    ["audit", "Audit summary"]
  ],
  admin: [
    ["home", "Administration console"],
    ["users", "Users and roles"],
    ["settings", "System settings"],
    ["audit", "Audit trail"],
    ["agreements", "Read-only portfolio"]
  ],
  auditor: [
    ["home", "Compliance workspace"],
    ["agreements", "Authorized records"],
    ["reports", "Compliance reports"],
    ["audit", "Audit trail"]
  ]
};

function navPath(key, home) {
  const paths = {
    home,
    agreements: "/agreements",
    new: "/agreements/new",
    partners: "/partners",
    reports: "/reports",
    users: "/users",
    audit: "/audit",
    settings: "/settings"
  };
  return paths[key];
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const config = roleConfig(user?.role);

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    api("/notifications").then(setNotifications).catch(() => {});
  }, [location.pathname]);

  const nav = useMemo(() => (roleNavigation[user?.role] || [["home", "Workspace"]]).map(([key, label]) => ({
    key,
    label,
    to: navPath(key, config.home),
    icon: iconMap[key] || FileText
  })), [user?.role, config.home]);

  const unread = notifications.filter((item) => !item.is_read).length;

  async function markRead(item) {
    if (!item.is_read) {
      await api(`/notifications/${item.id}/read`, { method: "POST" });
      setNotifications((current) => current.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark">A</div>
          <div>
            <strong>Accord 360</strong>
            <span>JKUAT Linkages</span>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)}><X size={20} /></button>
        </div>

        <div className="workspace-chip">
          <div className="workspace-icon"><FileText size={18} /></div>
          <div>
            <span>Signed in as</span>
            <strong>{config.label}</strong>
          </div>
          <ChevronDown size={16} />
        </div>

        <nav className="side-nav">
          <span className="nav-label">{config.workspace}</span>
          {nav.map(({ key, to, label, icon: Icon }) => (
            <NavLink key={`${key}-${to}`} to={to} end={key === "home"} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-mini">
            <div className="avatar">{user?.full_name?.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div>
            <div>
              <strong>{user?.full_name}</strong>
              <span>{config.label}</span>
            </div>
          </div>
          <button className="icon-button" onClick={logout} title="Sign out"><LogOut size={18} /></button>
        </div>
      </aside>

      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
          <div className="topbar-title">
            <strong>{config.workspace}</strong>
            <span>{config.shortDescription}</span>
          </div>
          <div className="topbar-actions">
            <span className="role-badge">{config.label}</span>
            <div className="notification-wrap">
              <button className="icon-button notification-button" onClick={() => setShowNotifications((value) => !value)}>
                <Bell size={20} />
                {unread > 0 && <span className="notification-dot">{unread}</span>}
              </button>
              {showNotifications && (
                <div className="notification-panel">
                  <div className="notification-panel-head">
                    <strong>Notifications</strong>
                    <span>{unread} unread</span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="notification-empty">No notifications yet.</p>
                  ) : notifications.slice(0, 8).map((item) => (
                    <button key={item.id} className={`notification-item ${item.is_read ? "read" : ""}`} onClick={() => markRead(item)}>
                      <span className={`notification-level level-${item.level}`} />
                      <div><strong>{item.title}</strong><p>{item.message}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="topbar-user">
              <div className="avatar avatar-small">{user?.full_name?.[0]}</div>
              <div><strong>{user?.full_name}</strong><span>{user?.department || "JKUAT"}</span></div>
            </div>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
