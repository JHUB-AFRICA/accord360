import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import SlaBadge from "../components/SlaBadge";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const roleControls = {
  researcher: ["Create and save partnership requests", "Respond to corrections", "Track status and next action"],
  approver: ["Validate academic fit", "Approve, return or reject with reasons", "Act only within departmental scope"],
  linkages: ["Verify completeness and partner data", "Route legal and signing actions", "Manage renewals and lifecycle exceptions"],
  legal: ["Review assigned drafts and versions", "Record legal decisions and risks", "Complete review within the 21-day threshold"],
  executive: ["Review escalations and portfolio risk", "Track signing and renewal decisions", "Use drill-down evidence for decisions"],
  me: ["Update targets and actual outputs", "Attach implementation evidence", "Resolve dormant partnership alerts"],
  auditor: ["Review approval and document history", "Check role and scope compliance", "Inspect tamper-evident audit records"],
  admin: ["Monitor workflow exceptions", "Maintain user roles and access", "Review system and audit health"]
};

export default function WorkQueue() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/dashboard/stats").then(setData).catch((err) => setError(err.message));
  }, []);

  if (!data && !error) return <div className="panel page-loading"><RefreshCw className="spin" /> Loading work queue...</div>;

  const queue = data?.priority_queue || [];
  const context = data?.role_context || { title: "My work queue", subtitle: "Records requiring action.", queue_label: "Priority actions" };

  return (
    <>
      <PageHeader eyebrow="Role-specific workspace" title={context.title} description={context.subtitle} />
      <div className="workspace-overview-grid">
        <section className="panel responsibility-card">
          <div className="responsibility-icon"><ClipboardCheck size={22} /></div>
          <h3>Your controlled responsibilities</h3>
          <div className="responsibility-list">
            {(roleControls[user?.role] || []).map((item) => <span key={item}><CheckCircle2 size={16} /> {item}</span>)}
          </div>
        </section>
        <section className="panel queue-summary-card">
          <span>Priority records</span>
          <strong>{queue.length}</strong>
          <p>{context.queue_label}</p>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><div><h3>{context.queue_label}</h3><p>Sorted by risk level, role ownership and time in the current stage.</p></div></div>
        {error ? <div className="form-error">{error}</div> : queue.length === 0 ? (
          <EmptyState title="No actions are currently due" text="Your queue is clear. New assignments and escalations will appear here." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Agreement</th><th>Partner</th><th>Stage</th><th>SLA</th><th>Status</th><th>Next action</th><th /></tr></thead>
              <tbody>{queue.map((item) => (
                <tr key={item.id}>
                  <td data-label="Agreement"><Link className="table-title" to={`/agreements/${item.id}`}>{item.title}</Link><span>{item.reference_number}</span></td>
                  <td data-label="Partner">{item.partner}</td>
                  <td data-label="Stage">{item.stage.replaceAll("_", " ")}</td>
                  <td data-label="SLA"><SlaBadge state={item.sla_state} days={item.days_in_stage} /></td>
                  <td data-label="Status"><StatusBadge color={item.status_color}>{item.status.replaceAll("_", " ")}</StatusBadge></td>
                  <td data-label="Next action">{item.next_action || "Review record"}</td>
                  <td data-label="Open"><Link className="icon-button table-open" to={`/agreements/${item.id}`} aria-label="Open agreement"><ArrowRight size={17} /></Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
