import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, BookOpen, Building2, ChevronRight, ClipboardCheck, ClipboardList, FileBarChart, FileSignature, FileText, Gauge, Gavel, HelpCircle, LogOut, Menu, MonitorCheck, PlusCircle, Search, Settings, ShieldCheck, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { roleConfig } from "../lib/roles";
import { notifications as demoNotifications } from "../lib/demoData";

const icons = { home: Gauge, requests: ClipboardList, new: PlusCircle, partners: Building2, agreements: FileText, corrections: ClipboardCheck, approvals: ClipboardCheck, legal: Gavel, dvc: ShieldCheck, signing: FileSignature, monitoring: MonitorCheck, reports: FileBarChart, users: Users, settings: Settings, audit: ShieldCheck, help: HelpCircle };
const navByRole = {
  researcher: [["home","Dashboard"],["new","Create request"],["requests","My requests"],["corrections","Corrections"],["agreements","My agreements"],["help","Help"]],
  approver: [["home","Dashboard"],["approvals","Approval queue"],["agreements","Department agreements"],["help","Help"]],
  linkages: [["home","Dashboard"],["requests","Partner requests"],["partners","Partners"],["agreements","Agreements"],["approvals","Review queue"],["corrections","Corrections"],["reports","Reports"],["help","Help"]],
  director_linkages: [["home","Dashboard"],["agreements","Portfolio"],["approvals","Escalations"],["reports","Reports"],["audit","Audit summary"],["help","Help"]],
  legal: [["home","Dashboard"],["legal","Legal queue"],["agreements","Approved versions"],["corrections","Returned drafts"],["help","Help"]],
  dvc: [["home","Dashboard"],["dvc","Endorsement queue"],["agreements","Endorsed packages"],["help","Help"]],
  vc_office: [["home","Dashboard"],["signing","Submission packages"],["agreements","Executed agreements"],["help","Help"]],
  me: [["home","Dashboard"],["monitoring","Six-month reports"],["agreements","Assigned partnerships"],["reports","Scorecards"],["help","Help"]],
  executive: [["home","Dashboard"],["agreements","Portfolio analytics"],["reports","Executive reports"],["audit","Risk & audit"],["help","Help"]],
  admin: [["home","Dashboard"],["users","Users & roles"],["settings","Configuration"],["audit","Audit log"],["help","Help"]],
  auditor: [["home","Dashboard"],["agreements","Authorized records"],["reports","Compliance reports"],["audit","Audit log"],["help","Help"]]
};
function pathFor(key, home) { return ({ home, new:"/agreements/new", requests:"/agreements", partners:"/partners", agreements:"/agreements", corrections:"/corrections", approvals:"/agreements", legal:"/agreements", dvc:"/agreements", signing:"/agreements", monitoring:"/monitoring", reports:"/reports", users:"/users", settings:"/settings", audit:"/audit", help:"/help" })[key]; }
export default function Layout() {
  const { user, logout } = useAuth(); const config = roleConfig(user?.role); const location = useLocation(); const navigate = useNavigate();
  const [open,setOpen]=useState(false); const [noticeOpen,setNoticeOpen]=useState(false); const [notices,setNotices]=useState(demoNotifications); const [query,setQuery]=useState("");
  useEffect(()=>setOpen(false),[location.pathname]);
  const nav = useMemo(()=> (navByRole[user?.role]||[["home","Dashboard"]]).map(([key,label])=>({key,label,to:pathFor(key,config.home),Icon:icons[key]||FileText})),[user?.role,config.home]);
  const unread=notices.filter(n=>!n.is_read).length;
  function submitSearch(e){e.preventDefault(); if(query.trim()) navigate(`/agreements?search=${encodeURIComponent(query.trim())}`);}
  return <div className="app-shell">
    <aside className={`sidebar ${open?"sidebar-open":""}`}>
      <div className="brand-block"><div className="brand-mark">A</div><div><strong>Accord360</strong><span>Directorate of Linkages (RPE)</span></div><button className="icon-button sidebar-close" onClick={()=>setOpen(false)} aria-label="Close menu"><X size={20}/></button></div>
      <div className="workspace-chip"><div className="workspace-icon"><BookOpen size={18}/></div><div><span>Workspace</span><strong>{config.workspace}</strong></div></div>
      <nav className="side-nav" aria-label="Primary navigation">{nav.map(({key,label,to,Icon})=><NavLink key={`${key}-${label}`} to={to} end={key==="home"} className={({isActive})=>`side-link ${isActive?"active":""}`}><Icon size={18}/><span>{label}</span>{key==="corrections"&&<em>1</em>}</NavLink>)}</nav>
      <div className="sidebar-footer"><div className="user-mini"><div className="avatar">{user?.full_name?.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><strong>{user?.full_name}</strong><span>{config.label}</span></div></div><button className="icon-button" onClick={logout} aria-label="Sign out"><LogOut size={18}/></button></div>
    </aside>
    {open&&<button className="sidebar-backdrop" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}
    <div className="main-column">
      <header className="topbar"><button className="icon-button menu-button" onClick={()=>setOpen(true)} aria-label="Open menu"><Menu size={22}/></button>
        <form className="global-search" onSubmit={submitSearch}><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search agreements, partners or references…"/><kbd>Enter</kbd></form>
        <div className="topbar-actions"><span className="role-badge">{config.label}</span><div className="notification-wrap"><button className="icon-button notification-button" onClick={()=>setNoticeOpen(v=>!v)} aria-label="Notifications"><Bell size={20}/>{unread>0&&<span className="notification-dot">{unread}</span>}</button>{noticeOpen&&<div className="notification-panel"><div className="notification-panel-head"><strong>Notifications</strong><span>{unread} unread</span></div>{notices.map(n=><button key={n.id} className={`notification-item ${n.is_read?"read":""}`} onClick={()=>setNotices(s=>s.map(x=>x.id===n.id?{...x,is_read:true}:x))}><span className={`notification-level level-${n.level}`}/><div><strong>{n.title}</strong><p>{n.message}</p></div><ChevronRight size={16}/></button>)}</div>}</div><div className="topbar-user"><div className="avatar avatar-small">{user?.full_name?.[0]}</div><div><strong>{user?.full_name}</strong><span>{user?.department||"JKUAT"}</span></div></div></div>
      </header>
      <main className="content"><Outlet/></main>
    </div>
  </div>;
}
