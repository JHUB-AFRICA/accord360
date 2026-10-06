import { Download, ExternalLink, FileCheck2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { downloadAgreementVersion, uploadAgreementDraft } from "../lib/backend.js";
import { formatDateTime } from "../lib/format.js";
import EmptyState from "./EmptyState.jsx";
import StatusBadge from "./StatusBadge.jsx";

// GOOGLE_DOCS_DRAFTING_BRIEF.md Section 5: drafting-stage content lives only
// in the live Google Doc (template_copy_url) — Accord 360 stores no file
// until the agreement is fully signed. So this tab shows the Doc link while
// drafting/review is in progress, and only shows a real, downloadable
// version once the final signed scan has been uploaded.
const DRAFTING_STATUSES = new Set([
  "draft_generated",
  "pending_legal_review",
  "returned_for_corrections",
  "pending_legal_verification",
  "approved_for_signing",
  "awaiting_signatures"
]);

export default function DocumentRepository({ record, user, onRecordChange, onError, onMessage }) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const isDrafting = DRAFTING_STATUSES.has(record.status);
  const canUpload = user.role === "linkages" && record.status === "awaiting_signatures";
  const versions = [...(record.versions || [])].reverse();

  async function upload() {
    if (!file) return onError("Choose the signed file to upload.");
    setSubmitting(true);
    try {
      const updated = await uploadAgreementDraft(record.id, file);
      onRecordChange(updated);
      setFile(null);
      onMessage("Final signed scan uploaded. This agreement is now fully executed and locked.");
    } catch (error) {
      onError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel data-panel">
      {isDrafting && <div className="panel inset-panel">
        <div className="panel-head"><div><h2>Drafting document</h2><p>This agreement is drafted directly in Google Docs. Everyone with access edits the same live document — nothing is uploaded to Accord 360 until it's signed.</p></div></div>
        {record.template_copy_url
          ? <a className="primary-button" href={record.template_copy_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open in Google Docs</a>
          : <p className="empty-state">No drafting document is linked to this agreement.</p>}
      </div>}

      <div className="panel-head">
        <div><h2>Final signed document</h2><p>Accord 360 stores exactly one file per agreement: the signed scan, uploaded once this is fully executed.</p></div>
      </div>
      <div className="document-list">
        {versions.map((version) => (
          <article className="document-row" key={version.id}>
            <span className="document-icon"><FileCheck2 /></span>
            <div>
              <strong>Final signed document</strong>
              <span>Uploaded by {version.uploaded_by?.full_name || "Accord360"}</span>
              <small>{formatDateTime(version.timestamp)}</small>
            </div>
            <StatusBadge tone="green">Final, locked</StatusBadge>
            <button className="icon-button" onClick={() => downloadAgreementVersion(record.id, version.id, `agreement-${record.id}-signed`).catch((error) => onError(error.message))} aria-label="Download the signed document"><Download size={18} /></button>
          </article>
        ))}
        {!versions.length && <EmptyState title="Not signed yet" text="The final signed document appears here once Linkages uploads it after physical signing." />}
      </div>

      {canUpload && <div className="panel inset-panel">
        <div className="panel-head"><div><h2>Upload final signed scan</h2><p>Once fully signed, upload the executed document. This locks the agreement.</p></div></div>
        <label className="upload-zone compact-upload"><UploadCloud /><strong>{file?.name || "Choose the signed file"}</strong><span>Only Linkages can upload at this stage.</span><input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <button className="primary-button" disabled={submitting || !file} onClick={upload}>{submitting ? "Uploading…" : "Upload"}</button>
      </div>}
    </section>
  );
}
