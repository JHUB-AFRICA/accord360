import { AlertTriangle, CheckCircle2, MessageSquarePlus, MessageSquareText, Scale } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import EmptyState from "./EmptyState";
import Modal from "./Modal";
import StatusBadge from "./StatusBadge";

const fallbackComparison = [
  {
    clause: "Template comparison unavailable",
    standard: "Standard-template clause text is not available for comparison.",
    working: "Upload or select a working draft to generate a clause-level comparison.",
    status: "pending"
  }
];

export default function LegalReviewPanel({ record, user, onRecordChange, onError, onMessage }) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentForm, setCommentForm] = useState({ clause: "", text: "", blocking: true });
  const [submitting, setSubmitting] = useState(false);
  const comparisons = record.template_comparison?.length ? record.template_comparison : fallbackComparison;
  const blockingCount = useMemo(
    () => (record.legal_comments || []).filter((item) => item.blocking && item.status !== "resolved").length,
    [record.legal_comments]
  );

  async function addComment() {
    if (!commentForm.clause.trim() || !commentForm.text.trim()) {
      onError("Select an exact clause or section and provide a Legal comment.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api(`/agreements/${record.id}/legal-comments`, {
        method: "POST",
        body: JSON.stringify(commentForm)
      });
      onRecordChange({ ...record, legal_comments: [...(record.legal_comments || []), created] });
      setCommentForm({ clause: "", text: "", blocking: true });
      setCommentOpen(false);
      onMessage("Legal comment added and audit event recorded.");
    } catch (error) {
      onError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function resolveComment(comment) {
    setSubmitting(true);
    try {
      const updated = await api(`/agreements/${record.id}/legal-comments/${comment.id}/resolve`, { method: "POST" });
      onRecordChange({
        ...record,
        legal_comments: (record.legal_comments || []).map((item) => item.id === updated.id ? updated : item)
      });
      onMessage("Legal comment marked resolved.");
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
          <div>
            <h2>Side-by-side template comparison</h2>
            <p>Compare the approved standard language against the current working draft.</p>
          </div>
          <StatusBadge tone={record.template?.compliance >= 90 ? "green" : "orange"}>
            {record.template?.compliance ?? 0}% aligned
          </StatusBadge>
        </div>
        <div className="comparison-table" role="table" aria-label="Template and working-draft comparison">
          <div className="comparison-heading" role="row">
            <strong role="columnheader">Clause / section</strong>
            <strong role="columnheader">Approved standard template</strong>
            <strong role="columnheader">Current working draft</strong>
          </div>
          {comparisons.map((item) => (
            <article className={`comparison-row comparison-${item.status || "review"}`} role="row" key={item.clause}>
              <div role="cell"><strong>{item.clause}</strong><StatusBadge status={item.status || "under_review"} /></div>
              <p role="cell">{item.standard}</p>
              <p role="cell">{item.working}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel detail-main-card">
          <div className="panel-head">
            <div><h2>Legal comments</h2><p>Clause-level feedback and blocking issues</p></div>
            <div className="panel-actions">
              <StatusBadge tone={blockingCount ? "red" : "green"}>{blockingCount} blocking</StatusBadge>
              {user.role === "legal" && record.stage === "legal_review" && (
                <button className="secondary-button compact-button" onClick={() => setCommentOpen(true)}>
                  <MessageSquarePlus size={16} /> Add Legal comment
                </button>
              )}
            </div>
          </div>
          <div className="comment-list">
            {(record.legal_comments || []).map((comment) => (
              <article key={comment.id} className={comment.blocking && comment.status !== "resolved" ? "blocking" : ""}>
                <div className="comment-head">
                  <div><strong>{comment.clause}</strong><span>{comment.author} · {formatDateTime(comment.created_at)}</span></div>
                  <StatusBadge status={comment.status} />
                </div>
                <p>{comment.text}</p>
                <div className="comment-footer">
                  {comment.blocking && <span className="blocking-label"><AlertTriangle size={14} /> Blocking comment</span>}
                  {user.role === "legal" && comment.status !== "resolved" && (
                    <button className="text-button" disabled={submitting} onClick={() => resolveComment(comment)}>
                      <CheckCircle2 size={15} /> Mark resolved
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!record.legal_comments?.length && <EmptyState title="No Legal comments" text="Add a clause-level comment when an issue is identified." />}
          </div>
        </section>

        <aside className="panel detail-side-card">
          <div className="panel-head"><div><h2>Structured corrections</h2><p>Direct links to exact required changes</p></div></div>
          <div className="compact-list">
            {(record.corrections || []).map((correctionId) => (
              <Link key={correctionId} to={`/corrections/${correctionId}`}>
                <span className="list-icon orange"><MessageSquareText /></span>
                <div><strong>{correctionId.toUpperCase()}</strong><span>Open correction record</span></div>
              </Link>
            ))}
            {!record.corrections?.length && <div className="inline-empty"><CheckCircle2 /> No correction records.</div>}
          </div>
          <div className="helper-note"><Scale size={16} /> Legal approval remains unavailable while a blocking comment is unresolved.</div>
        </aside>
      </div>

      <Modal
        open={commentOpen}
        onClose={() => setCommentOpen(false)}
        title="Add Legal comment"
        description="Link the issue to an exact clause, field or document section. Blocking comments prevent Legal approval."
        footer={<><button className="secondary-button" onClick={() => setCommentOpen(false)}>Cancel</button><button className="primary-button" disabled={submitting} onClick={addComment}>{submitting ? "Saving…" : "Add comment"}</button></>}
      >
        <div className="form-grid single-column">
          <label className="form-field"><span>Exact clause or section *</span><input value={commentForm.clause} onChange={(event) => setCommentForm({ ...commentForm, clause: event.target.value })} placeholder="Clause 7.2 — Intellectual Property" /></label>
          <label className="form-field"><span>Legal comment *</span><textarea rows="5" value={commentForm.text} onChange={(event) => setCommentForm({ ...commentForm, text: event.target.value })} placeholder="Describe the issue and the exact amendment required." /></label>
          <label className="consent-box"><input type="checkbox" checked={commentForm.blocking} onChange={(event) => setCommentForm({ ...commentForm, blocking: event.target.checked })} /><span>Mark as blocking. Legal approval cannot proceed until this comment is resolved.</span></label>
        </div>
      </Modal>
    </>
  );
}
