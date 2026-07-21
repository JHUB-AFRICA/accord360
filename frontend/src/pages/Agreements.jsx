import { useEffect, useState } from "react";
import { Download, Filter, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import LifecycleStrip from "../components/LifecycleStrip";
import PageHeader from "../components/PageHeader";
import SlaBadge from "../components/SlaBadge";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

export default function Agreements() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (stage) query.set("stage", stage);
    if (type) query.set("agreement_type", type);
    const timer = setTimeout(() => {
      setLoading(true);
      api(`/agreements?${query}`).then(setItems).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, stage, type]);

  async function exportCsv() {
    const blob = await api("/reports/agreements.csv");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "accord360-agreements.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const canCreate = ["researcher", "linkages", "admin"].includes(user?.role);

  return (
    <>
      <PageHeader
        eyebrow="Lifecycle tracker"
        title="Agreement portfolio"
        description="Monitor every MoU, CRA and CA by controlled stage, owner, SLA position, risk colour and next action."
        actions={<><button className="secondary-button" onClick={exportCsv}><Download size={17} /> Export authorized records</button>{canCreate && <Link className="primary-button" to="/agreements/new"><Plus size={18} /> New request</Link>}</>}
      />

      <LifecycleStrip compact />

      <div className="panel filter-panel">
        <label className="search-field"><Search size={18} /><input placeholder="Search title or reference..." value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="select-field"><Filter size={17} /><select value={stage} onChange={(e) => setStage(e.target.value)}><option value="">All stages</option><option value="initiation">Initiation</option><option value="department_approval">Department approval</option><option value="linkages_review">Linkages review</option><option value="legal_review">Legal review</option><option value="validation_signing">Validation & signing</option><option value="active">Active / M&E</option><option value="renewal_closure">Renewal / closure</option><option value="archived">Archived</option></select></label>
        <label className="select-field"><select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option>MoU</option><option>CRA</option><option>CA</option><option>Other</option></select></label>
      </div>

      <div className="panel">
        {loading ? <div className="table-loading">Loading agreements...</div> : items.length === 0 ? <EmptyState title="No matching agreements" text="Change the filters or create a new request." action={canCreate ? <Link className="primary-button" to="/agreements/new"><Plus size={17} /> New request</Link> : null} /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Reference & title</th><th>Partner</th><th>Type</th><th>Stage</th><th>SLA / timer</th><th>Status</th><th>Next action</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Agreement"><Link className="table-title" to={`/agreements/${item.id}`}>{item.title}</Link><span>{item.reference_number} · {item.department}</span></td>
                  <td data-label="Partner">{item.partner.name}</td>
                  <td data-label="Type"><span className="type-pill">{item.agreement_type}</span></td>
                  <td data-label="Stage">{item.stage.replaceAll("_", " ")}</td>
                  <td data-label="SLA"><SlaBadge state={item.sla_state} days={item.days_in_stage} target={item.sla_target_days} /></td>
                  <td data-label="Status"><StatusBadge color={item.status_color}>{item.status.replaceAll("_", " ")}</StatusBadge></td>
                  <td data-label="Next action">{item.next_action || "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
