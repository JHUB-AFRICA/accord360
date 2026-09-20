import { AlertTriangle, CheckCircle2, MessageSquarePlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createVersionComment, listVersionComments, transitionAgreement, updateVersionComment } from "../lib/backend.js";
import { formatDateTime } from "../lib/format.js";
import EmptyState from "./EmptyState.jsx";
import Modal from "./Modal.jsx";
import StatusBadge from "./StatusBadge.jsx";

// Legal comments (REBUILD_BRIEF.md Section 4.1) are scoped to the current
// AgreementVersion. Only Legal can create them, only while the agreement is
// pending_legal_review/pending_legal_verification (Section 2.3). Requesting
// corrections and approving reuse the server-derived available_actions list
// (Section 5.2) rather than a second, hardcoded permission matrix.
export default function LegalReviewPanel({ record, user, onRecordChange, onError, onMessage }) {
  const currentVersion = record.versions?.length ? record.versions[record.versions.length - 1] : null;
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [sectionReference, setSectionReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");

  const canComment = user.role === "legal" && ["pending_legal_review", "pending_legal_verification"].includes(record.status);
  const canRequestCorrections = (record.available_actions || []).includes("request_corrections");
  const canApprove = (record.available_actions || []).includes("approve");

  const loadComments = useCallback(() => {
    if (!currentVersion) { setComments([]); return; }
    listVersionComments(currentVersion.id).then(setComments).catch((error) => onError(error.message));
  }, [currentVersion?.id, onError]);

  useEffect(() => { loadComments(); }, [loadComments]);

  async function submitComment(event) {
    event.preventDefault();
    if (!text.trim()) return onError("Enter comment text before submitting.");
    setSubmitting(true);
    try {
      await createVersionComment(currentVersion.id, { text: text.trim(), section_reference: sectionReference.trim() || null });
      setText("");
      setSectionReference("");
      onMessage("Comment added.");
      loadComments();
    } catch (error) {
      onError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleResolve(comment) {
    try {
      await updateVersionComment(comment.id, comment.status === "open" ? "resolved" : "open");
      loadComments();
    } catch (error) {
      onError(error.message);
    }
  }

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
          <div><h2>Legal review</h2><p>Comments are scoped to the current agreement version. Only Legal can add or resolve them.</p></div>
          <div className="inline-actions">
            {canRequestCorrections && <button className="secondary-button compact-button" onClick={() => setCorrectionOpen(true)}><MessageSquarePlus size={16} /> Request corrections</button>}
            {canApprove && <button className="primary-button compact-button" disabled={submitting} onClick={approveDraft}><CheckCircle2 size={16} /> Approve draft</button>}
          </div>
        </div>
        {currentVersion
          ? <div className="comment-list">
              {comments.map((comment) => (
                <article key={comment.id} className={comment.status === "open" ? "blocking" : ""}>
                  <div className="comment-head">
                    <div><strong>{comment.author?.full_name || "Legal"}</strong><span>{comment.section_reference ? `${comment.section_reference} · ` : ""}{formatDateTime(comment.timestamp)}</span></div>
                    <StatusBadge tone={comment.status === "open" ? "orange" : "green"}>{comment.status === "open" ? "Open" : "Resolved"}</StatusBadge>
                  </div>
                  <p>{comment.text}</p>
                  {user.role === "legal" && <div className="comment-footer"><button className="text-button" onClick={() => toggleResolve(comment)}>{comment.status === "open" ? "Mark resolved" : "Reopen"}</button></div>}
                </article>
              ))}
              {!comments.length && <EmptyState title="No comments yet" text="Legal's comments on this version will appear here." />}
            </div>
          : <EmptyState title="No version to review" text="A version must exist before comments can be added." />}
        {canComment && currentVersion && <form className="form-grid" onSubmit={submitComment}>
          <label className="form-field"><span>Section reference</span><input value={sectionReference} onChange={(event) => setSectionReference(event.target.value)} placeholder="Clause 7.2" /></label>
          <label className="form-field span-2"><span>Comment *</span><textarea rows="3" value={text} onChange={(event) => setText(event.target.value)} /></label>
          <button className="primary-button" disabled={submitting} type="submit">{submitting ? "Adding…" : "Add comment"}</button>
        </form>}
        {!canComment && record.status === "returned_for_corrections" && <p className="helper-note"><AlertTriangle size={14} /> Comments are read-only while Linkages prepares the corrected draft.</p>}
      </section>

      <Modal
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        title="Return agreement for corrections"
        description="Moves the agreement to Returned for Corrections and notifies Linkages to upload a corrected draft."
        footer={<><button className="secondary-button" onClick={() => setCorrectionOpen(false)}>Cancel</button><button className="primary-button" disabled={submitting} onClick={requestCorrections}>{submitting ? "Returning…" : "Return for corrections"}</button></>}
      >
        <label className="form-field"><span>Summary for Linkages</span><textarea rows="4" value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} placeholder="Optional summary of what needs to change." /></label>
      </Modal>
    </>
  );
}
