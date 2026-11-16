import { Download, ExternalLink, FileCheck2, Lock, UploadCloud } from "lucide-react";
import { useState } from "react";
import { downloadAgreementVersion, downloadSigningCopy, uploadAgreementDraft } from "../lib/backend.js";
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
  "linkages_review",
  "legal_review",
  "returned_to_researcher",
  "approved_for_signing",
  "awaiting_signatures"
]);
// From Legal approval until the signed upload the Doc is locked: the API
// withholds its link and Linkages works from the exported signing copy.
const SIGNING_COPY_STATUSES = new Set(["approved_for_signing", "awaiting_signatures"]);
const MAX_SIGNED_FILE_BYTES = 25 * 1024 * 1024;

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "Size not recorded";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function fileType(version) {
  const name = version.original_filename || version.name || "";
  if (version.content_type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return "PDF";
  if (version.content_type?.includes("wordprocessingml") || name.toLowerCase().endsWith(".docx")) return "DOCX";
  return "Signed document";
}

export default function DocumentRepository({ record, user, onRecordChange, onError, onMessage, onStale }) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState("");
  const isDrafting = DRAFTING_STATUSES.has(record.status);
  const isLocked = SIGNING_COPY_STATUSES.has(record.status);
  const canDownloadSigningCopy = user.role === "linkages" && isLocked;
  const canUpload = user.role === "linkages" && record.status === "awaiting_signatures";
  const versions = [...(record.versions || [])].reverse();

  async function upload() {
    if (!file) return onError("Choose the signed file to upload.");
    if (!isAllowedFile(file)) return onError("Only PDF or DOCX files up to 25 MB are allowed.");
    if (!window.confirm("This file will become the official signed agreement and cannot be replaced. Continue?")) return;
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

  function isAllowedFile(candidate) {
    const extension = candidate?.name?.toLowerCase().split(".").pop();
    return ["pdf", "docx"].includes(extension) && candidate.size <= MAX_SIGNED_FILE_BYTES;
  }

  function chooseFile(event) {
    const candidate = event.target.files?.[0] || null;
    if (candidate && !isAllowedFile(candidate)) {
      event.target.value = "";
      setFile(null);
      onError("Only PDF or DOCX files up to 25 MB are allowed.");
      return;
    }
    setFile(candidate);
  }

  async function downloadCopy(format) {
    setExporting(format);
    try {
      await downloadSigningCopy(record.id, format);
    } catch (error) {
      onError(error.message);
      // 409 = the Doc changed after approval; reload so the
      // "Send back to Legal" option appears.
      if (error.status === 409) onStale?.();
    } finally {
      setExporting("");
    }
  }

  return (
    <section className="panel data-panel">
      {isDrafting && <div className="panel inset-panel">
        {isLocked
          ? <div className="panel-head"><div><h2>Legal-approved agreement</h2><p>Legal has approved this text. The Google Doc is locked until the signed version is uploaded, so it can't be opened or edited from here.</p></div></div>
          : <div className="panel-head"><div><h2>Drafting document</h2><p>This agreement is drafted directly in Google Docs. Everyone with access edits the same live document — nothing is uploaded to Accord 360 until it's signed.</p></div></div>}
        {isLocked
          ? <p className="helper-note"><Lock size={14} /> Google Doc locked after Legal approval.</p>
          : record.template_copy_url
            ? <a className="primary-button" href={record.template_copy_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open in Google Docs</a>
            : <p className="empty-state">No drafting document is linked to this agreement.</p>}
        {canDownloadSigningCopy && <div className="signing-copy-actions" aria-label="Download Legal-approved signing copy">
          <span>Legal-approved signing copy — download this file for physical signing:</span>
          <button className="secondary-button compact-button" disabled={Boolean(exporting)} onClick={() => downloadCopy("docx")}><Download size={15} /> {exporting === "docx" ? "Preparing Word…" : "Download Word"}</button>
          <button className="secondary-button compact-button" disabled={Boolean(exporting)} onClick={() => downloadCopy("pdf")}><Download size={15} /> {exporting === "pdf" ? "Preparing PDF…" : "Download PDF"}</button>
        </div>}
      </div>}

      <div className="panel-head">
        <div><h2>Final signed document</h2><p>Accord 360 stores exactly one file per agreement: the signed scan, uploaded once this is fully executed.</p></div>
      </div>
      <div className="document-list">
        {versions.map((version) => (
          <article className="document-row" key={version.id}>
            <span className="document-icon"><FileCheck2 /></span>
            <div>
              <strong>Official signed agreement</strong>
              <span>{version.original_filename || version.name} · {fileType(version)} · {formatBytes(version.byte_size)}</span>
              <span>Uploaded by {version.uploaded_by || "Accord360"}</span>
              <small>{formatDateTime(version.timestamp)}</small>
            </div>
            <StatusBadge tone="green">Final, locked</StatusBadge>
            <button className="secondary-button compact-button" onClick={() => downloadAgreementVersion(record.id, version.id, version.original_filename || `agreement-${record.id}-signed` ).catch((error) => onError(error.message))} aria-label="Download the official signed agreement"><Download size={15} /> Download</button>
          </article>
        ))}
        {!versions.length && <EmptyState title="Not signed yet" text="The final signed document appears here once Linkages uploads it after physical signing." />}
      </div>

      {canUpload && <div className="panel inset-panel">
        <div className="panel-head"><div><h2>Upload final signed agreement</h2><p>Upload the physically signed copy. It becomes the official immutable agreement and cannot be replaced.</p></div></div>
        <label className="upload-zone compact-upload"><UploadCloud /><strong>{file?.name || "Choose the signed file"}</strong><span>Only Linkages can upload at this stage. PDF or DOCX, maximum 25 MB.</span><input type="file" accept=".pdf,.docx" onChange={chooseFile} /></label>
        <button className="primary-button" disabled={submitting || !file} onClick={upload}>{submitting ? "Uploading…" : "Upload"}</button>
      </div>}
    </section>
  );
}
