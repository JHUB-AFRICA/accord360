import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { api } from "../lib/api";

export default function Audit() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api("/reports/audit").then(setItems).catch((err) => setError(err.message)); }, []);
  return (
    <>
      <PageHeader eyebrow="Compliance and traceability" title="Audit trail" description="Review material changes, workflow actions, uploads and administrative activity." />
      <div className="panel">
        {error ? <div className="form-error">{error}</div> : <div className="audit-list">{items.map((item) => <div className="audit-row" key={item.id}><div className="audit-icon"><ShieldCheck size={18} /></div><div><strong>{item.action.replaceAll("_", " ")}</strong><p>{item.object_type} #{item.object_id}</p><span>{item.actor?.full_name || "System"} · {new Date(item.created_at).toLocaleString()}</span></div></div>)}</div>}
      </div>
    </>
  );
}
