import { AlertTriangle, CheckCircle2, ExternalLink, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { transitionAgreement } from "../lib/backend.js";
import { formatDateTime } from "../lib/format.js";
import EmptyState from "./EmptyState.jsx";
import Modal from "./Modal.jsx";

// GOOGLE_DOCS_DRAFTING_BRIEF.md Section 6: Legal's comments live natively in
// the Google Doc — Accord 360 doesn't mirror comment text, it only logs
// that a "returned for corrections" event happened (WorkflowEvent.comment,
// already populated by transitionAgreement's `comment` field). So this
// panel is a link out to the Doc plus that correction history, not a
// comment thread. Requesting corrections and approving reuse the
// server-derived available_actions list rather than a hardcoded matrix.
export default function LegalReviewPanel({ record, user, onRecordChange, onError, onMessage }) {
  const [submitting, setSubmitting] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");

  const canRequestCorrections = (record.available_actions || []).includes("request_corrections");
  const canApprove = (record.available_actions || []).includes("approve");
  const correctionEvents = (record.workflow_events || [])
    .filter((event) => event.action === "request_corrections")
    .slice()
    .reverse();

  async function requestCorrections() {
    setSubmitting(true);
    try {
      const updated = await transitionAgreement(record.id, "request_corrections", correctionNote.trim() || null);
      onRecordChange(updated);
      onMessage("Agreement returned to Linkages for corrections.");
      setCorrectionOpen(false);
      setCorrectionNote("");
    } catch (error) {
      onError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function approveDraft() {
    setSubmitting(true);
    try {
      const updated = await transitionAgreement(record.id, "approve");
      onRecordChange(updated);
      onMessage("Draft approved for signing.");
    } catch (error) {
      onError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="panel legal-comparison-panel">
        <div className="panel-head">
          <div><h2>Legal review</h2><p>Comment directly on the Google Doc — Accord 360 only tracks the correction history below, not the comment text itself.</p></div>
          {record.template_copy_url && <a className="secondary-button compact-button" href={record.template_copy_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open in Google Docs</a>}
        </div>
        <div className="inline-actions">
          {canRequestCorrections && <button className="secondary-button compact-button" onClick={() => setCorrectionOpen(true)}><MessageSquarePlus size={16} /> Request corrections</button>}
          {canApprove && <button className="primary-button compact-button" disabled={submitting} onClick={approveDraft}><CheckCircle2 size={16} /> Approve draft</button>}
        </div>
      </section>

      <section className="panel legal-comparison-panel">
        <div className="panel-head"><div><h2>Correction history</h2><p>Every time Legal has sent this agreement back, and the summary Linkages was given to relay.</p></div></div>
        {correctionEvents.length
          ? <div className="activity-timeline">
              {correctionEvents.map((event) => (
                <article key={event.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{event.actor?.full_name || "Legal"}</strong>
                    <p>{event.comment || "No summary was recorded for this correction request."}</p>
                    <small>{formatDateTime(event.created_at)}</small>
                  </div>
                </article>
              ))}
            </div>
          : <EmptyState title="No corrections requested yet" text="Correction requests and their summaries will appear here." />}
        {user.role === "legal" && !canRequestCorrections && !canApprove && <p className="helper-note"><AlertTriangle size={14} /> This agreement isn't awaiting a Legal decision right now.</p>}
      </section>

      <Modal
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        title="Return agreement for corrections"
        description="Moves the agreement to Returned for Corrections and notifies Linkages to relay the changes to the Researcher."
        footer={<><button className="secondary-button" onClick={() => setCorrectionOpen(false)}>Cancel</button><button className="primary-button" disabled={submitting} onClick={requestCorrections}>{submitting ? "Returning…" : "Return for corrections"}</button></>}
      >
        <label className="form-field"><span>Summary for Linkages</span><textarea rows="4" value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} placeholder="Optional summary of what needs to change — the comments themselves are in the Google Doc." /></label>
      </Modal>
    </>
  );
}
