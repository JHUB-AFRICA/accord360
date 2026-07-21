import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  Bell,
  Building2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileText,
  Gauge,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const roleLabels = {
  admin: "System administrator",
  researcher: "Researcher portal",
  approver: "Department approver",
  linkages: "Linkages operations",
  legal: "Legal workspace",
  executive: "Executive intelligence",
  me: "M&E workspace",
  auditor: "Assurance review"
};

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    api("/notifications").then(setNotifications).catch(() => {});
  }, [location.pathname]);

  const nav = useMemo(() => {
    const items = [
      { to: "/", label: "Overview", icon: Gauge },
      { to: "/work", label: "My work", icon: ClipboardCheck },
      { to: "/agreements", label: "Agreements", icon: ClipboardList }
    ];
    if (["admin", "linkages", "executive"].includes(user?.role)) {
      items.push({ to: "/partners", label: "Partners", icon: Building2 });
    }
    if (["admin", "linkages", "me", "executive", "auditor"].includes(user?.role)) {
      items.push({ to: "/monitoring", label: "Monitoring & Evaluation", icon: Activity });
    }
    if (["admin", "linkages", "executive", "auditor"].includes(user?.role)) {
      items.push({ to: "/reports", label: "Reports", icon: FileBarChart });
    }
    return items;
  }, [user?.role]);

  const systemNav = [];
  if (user?.role === "admin") systemNav.push({ to: "/users", label: "Users & roles", icon: Users });
  if (["admin", "auditor", "executive"].includes(user?.role)) systemNav.push({ to: "/audit", label: "Audit trail", icon: ShieldCheck });
  if (user?.role === "admin") systemNav.push({ to: "/settings", label: "Settings", icon: Settings });

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
            <span>Current channel</span>
            <strong>{roleLabels[user?.role] || "Partnership portfolio"}</strong>
          </div>
          <ChevronDown size={16} />
        </div>

        <nav className="side-nav">
          <span className="nav-label">Workspace</span>
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
          {systemNav.length > 0 && <span className="nav-label nav-label-spaced">Governance</span>}
          {systemNav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
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
              <span>{roleLabels[user?.role] || user?.role?.replace("_", " ")}</span>
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
            <strong>Agreement Lifecycle & Performance Management</strong>
            <span>{roleLabels[user?.role]} · controlled access and shared accountability</span>
          </div>
          <div className="topbar-actions">
            <div className="notification-wrap">
              <button className="icon-button notification-button" onClick={() => setShowNotifications((value) => !value)} aria-label="Open notifications">
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
