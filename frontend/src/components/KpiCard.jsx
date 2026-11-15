import { Link } from "react-router-dom";

export default function KpiCard({ label, value, helper, tone = "blue", icon: Icon, to }) {
  const content = <>
    <div className="kpi-copy"><span>{label}</span><strong>{value}</strong>{helper && <small>{helper}</small>}</div>
    {Icon && <div className="kpi-icon"><Icon size={22} /></div>}
  </>;
  if (to) {
    return <Link to={to} className={`kpi-card kpi-${tone} kpi-clickable`}>{content}</Link>;
  }
  return <article className={`kpi-card kpi-${tone}`}>{content}</article>;
}
