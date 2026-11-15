import { ExternalLink } from "lucide-react";
import { formatDateTime, humanize } from "../lib/format.js";
import EmptyState from "./EmptyState.jsx";

// Linkages <-> Legal review stage. The review itself happens natively in the
// Google Doc (comments and edits) — Accord 360 doesn't mirror comment text.
// This panel links out to the Doc and shows the hand-off history. The
// actions (send to Legal, return, approve) are the server-derived
// available_actions buttons in the page header, not a duplicated matrix.
const HANDOFF_ACTIONS = new Set(["submit", "send_to_legal", "return_to_researcher", "return_to_linkages", "resubmit", "approve"]);

export default function ReviewPanel({ record }) {
  const handoffs = (record.workflow_events || []).filter((event) => HANDOFF_ACTIONS.has(event.action)).slice().reverse();

  return (
    <>
      <section className="panel legal-comparison-panel">
        <div className="panel-head">
          <div><h2>Review</h2><p>Linkages and Legal review and comment directly in the Google Doc. Accord 360 only tracks who has it and the hand-offs below — not the comment text.</p></div>
          {record.template_copy_url && <a className="secondary-button compact-button" href={record.template_copy_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open in Google Docs</a>}
        </div>
      </section>

      <section className="panel legal-comparison-panel">
        <div className="panel-head"><div><h2>Hand-off history</h2><p>Each time this agreement moved between the Researcher, Linkages and Legal, with any note that was left.</p></div></div>
        {handoffs.length
          ? <div className="activity-timeline">
              {handoffs.map((event) => (
                <article key={event.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{humanize(event.action)} · {event.actor?.full_name || "System"}</strong>
                    <p>{event.comment || "No note was left."}</p>
                    <small>{formatDateTime(event.created_at)}</small>
                  </div>
                </article>
              ))}
            </div>
          : <EmptyState title="No hand-offs yet" text="Hand-offs between the Researcher, Linkages and Legal will appear here." />}
      </section>
    </>
  );
}
