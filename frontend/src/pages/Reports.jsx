import { useEffect, useState } from "react";
import { Download, FileBarChart, ShieldAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageHeader from "../components/PageHeader";
import { api } from "../lib/api";

export default function Reports() {
  const [data, setData] = useState(null);
  useEffect(() => { api("/dashboard/stats").then(setData); }, []);
  async function download() {
    const blob = await api("/reports/agreements.csv");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "accord360-agreements.csv"; link.click(); URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeader eyebrow="Analytics and exports" title="Reports" description="Use operational and executive reporting to identify pipeline pressure, risk, value and data quality issues." actions={<button className="primary-button" onClick={download}><Download size={17} /> Download agreement register</button>} />
      <div className="report-card-grid">
        {["Pipeline by stage", "Active partnerships", "Expiry and renewal", "Dormancy report", "Legal SLA report", "M&E output report", "Value generated", "Data quality report"].map((name, index) => (
          <article className="panel report-card" key={name}><div className={`report-icon report-icon-${index % 4}`}><FileBarChart size={21} /></div><div><h3>{name}</h3><p>Filtered, timestamped report for authorized users.</p></div><button className="text-link" onClick={download}>Export CSV</button></article>
        ))}
      </div>
      {data && <div className="dashboard-grid">
        <div className="panel chart-panel span-2"><div className="panel-head"><div><h3>Agreement volume by lifecycle stage</h3><p>Operational portfolio distribution</p></div></div><div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.by_stage}><CartesianGrid strokeDasharray="4 4" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="panel risk-summary"><div className="risk-icon"><ShieldAlert size={25} /></div><h3>Risk snapshot</h3><strong>{data.kpis.at_risk}</strong><p>Agreements currently marked orange or red and requiring management attention.</p></div>
      </div>}
    </>
  );
}
