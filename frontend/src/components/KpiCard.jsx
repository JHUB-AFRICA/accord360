export default function KpiCard({ label, value, helper, tone = "blue", icon: Icon }) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-copy"><span>{label}</span><strong>{value}</strong>{helper && <small>{helper}</small>}</div>
      {Icon && <div className="kpi-icon"><Icon size={22} /></div>}
    </article>
  );
}
