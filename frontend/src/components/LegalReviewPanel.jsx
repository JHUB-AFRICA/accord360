import { AlertTriangle, CheckCircle2, MessageSquarePlus, Scale } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { transitionAgreement } from "../lib/backend.js";
import { formatDateTime, humanize } from "../lib/format.js";
import EmptyState from "./EmptyState.jsx";
import Modal from "./Modal.jsx";
import StatusBadge from "./StatusBadge.jsx";

export default function LegalReviewPanel({ record, user, onRecordChange, onError, onMessage }) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ exactItem: "", requestedChange: "", details: "" });
  const reviewEvents = (record.workflow_events || []).filter((event) => event.comment || ["send_legal", "approve_legal", "return_correction", "return_dvc"].includes(event.action));
  const canReturn = user.role === "legal" && record.backend_stage === "legal_review";

  async function requestAmendment() {
    if (!form.exactItem.trim() || !form.requestedChange.trim()) {
      onError("Identify the exact clause, field or document and the requested change.");
      return;
    }
    setSubmitting(true);
    try {
      const comment = [
        `LEGAL CORRECTION`,
        `Exact item: ${form.exactItem.trim()}`,
        `Requested change: ${form.requestedChange.trim()}`,
        form.details.trim() ? `Additional context: ${form.details.trim()}` : null
      ].filter(Boolean).join("\n");
      const updated = await transitionAgreement(record.id, "return_correction", comment);
      onRecordChange(updated);
      onMessage("The agreement was returned for correction using the supported workflow transition endpoint.");
      setForm({ exactItem: "", requestedChange: "", details: "" });
      setCommentOpen(false);
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
          <div><h2>Legal review record</h2><p>The current backend exposes Legal feedback as workflow-event comments rather than separate clause-comment endpoints.</p></div>
          {canReturn && <button className="secondary-button compact-button" onClick={() => setCommentOpen(true)}><MessageSquarePlus size={16} /> Request amendment</button>}
        </div>
        <div className="comparison-table" role="table" aria-label="Legal review evidence">
          <div className="comparison-header" role="row"><strong role="columnheader">Evidence</strong><strong role="columnheader">Current backend value</strong><strong role="columnheader">Review status</strong></div>
          <article className="comparison-row" role="row"><div role="cell"><strong>Agreement draft</strong></div><p role="cell">{record.documents.find((item) => item.type === "working_draft")?.name || "No working draft document classified"}</p><p role="cell"><StatusBadge status={record.status} /></p></article>
          <article className="comparison-row" role="row"><div role="cell"><strong>Legal-approved document</strong></div><p role="cell">{record.documents.find((item) => item.type === "legal_approved" && item.is_official)?.name || "Not yet uploaded as an official Legal-approved document"}</p><p role="cell"><StatusBadge tone={record.status === "legal_approved" ? "green" : "yellow"}>{record.status === "legal_approved" ? "Approved" : "Pending"}</StatusBadge></p></article>
          <article className="comparison-row" role="row"><div role="cell"><strong>Confidentiality</strong></div><p role="cell">{humanize(record.confidentiality)}</p><p role="cell"><StatusBadge tone="blue">Backend controlled</StatusBadge></p></article>
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel detail-main-card">
          <div className="panel-head"><div><h2>Review comments and events</h2><p>Every displayed item is sourced from the agreement workflow history.</p></div></div>
          <div className="comment-list">
            {reviewEvents.map((event) => (
              <article key={event.id} className={["return_correction", "return_dvc"].includes(event.action) ? "blocking" : ""}>
                <div className="comment-head"><div><strong>{humanize(event.action)}</strong><span>{event.actor?.full_name || "Accord360 user"} · {formatDateTime(event.created_at)}</span></div><StatusBadge tone={["return_correction", "return_dvc"].includes(event.action) ? "orange" : "blue"}>{humanize(event.to_stage)}</StatusBadge></div>
                <p>{event.comment || "No comment was recorded for this workflow event."}</p>
                {["return_correction", "return_dvc"].includes(event.action) && <div className="comment-footer"><span className="blocking-label"><AlertTriangle size={14} /> Requires correction and resubmission</span></div>}
              </article>
            ))}
            {!reviewEvents.length && <EmptyState title="No review comments recorded" text="Workflow comments will appear here after a review action is completed." />}
          </div>
        </section>

        <aside className="panel detail-side-card">
          <div className="panel-head"><div><h2>Correction response</h2><p>Corrections are derived from the agreement status and workflow comments.</p></div></div>
          {record.status === "correction_required" || record.status === "dvc_returned" ? <Link className="quick-link-card" to={`/corrections/${record.id}`}><span className="list-icon orange"><AlertTriangle /></span><div><strong>Open correction workspace</strong><span>Review the latest return comment and resubmit the agreement.</span></div></Link> : <div className="inline-empty"><CheckCircle2 /> No active correction is recorded.</div>}
          <div className="helper-note"><Scale size={16} /> Separate clause-level comments and resolution states require a future backend endpoint. This frontend does not call an endpoint that is not implemented.</div>
        </aside>
      </div>

      <Modal
        open={commentOpen}
        onClose={() => setCommentOpen(false)}
        title="Return agreement for Legal correction"
        description="This performs the implemented return_correction transition and stores the structured details in its comment."
        footer={<><button className="secondary-button" onClick={() => setCommentOpen(false)}>Cancel</button><button className="primary-button" disabled={submitting} onClick={requestAmendment}>{submitting ? "Returning…" : "Return for correction"}</button></>}
      >
        <div className="form-grid single-column">
          <label className="form-field"><span>Exact clause, field or document *</span><input value={form.exactItem} onChange={(event) => setForm({ ...form, exactItem: event.target.value })} placeholder="Clause 7.2 — Intellectual Property" /></label>
          <label className="form-field"><span>Requested change *</span><textarea rows="4" value={form.requestedChange} onChange={(event) => setForm({ ...form, requestedChange: event.target.value })} /></label>
          <label className="form-field"><span>Additional context</span><textarea rows="3" value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} /></label>
        </div>
      </Modal>
    </>
  );
}
