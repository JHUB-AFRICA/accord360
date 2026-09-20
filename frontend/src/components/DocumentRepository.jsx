import { Download, FileCheck2, FileText, UploadCloud } from "lucide-react";
import { useState } from "react";
import { downloadAgreementVersion, uploadAgreementDraft } from "../lib/backend.js";
import { formatDateTime } from "../lib/format.js";
import EmptyState from "./EmptyState.jsx";
import StatusBadge from "./StatusBadge.jsx";

// Version history and the single upload path (REBUILD_BRIEF.md Section 3.2,
// 4.2, 4.3): Linkages uploads a new AgreementVersion at exactly three points
// in the lifecycle (draft_generated, returned_for_corrections,
// awaiting_signatures) through the same POST /agreements/{id}/versions
// endpoint; no one else ever uploads a version.
const UPLOAD_COPY = {
  draft_generated: { title: "Upload legal agreement draft", helper: "Review the Researcher intake, prepare the agreement, then upload the .docx for Legal." },
  returned_for_corrections: { title: "Upload corrected agreement draft", helper: "Upload the corrected .docx so Legal can verify the requested changes were made." },
  awaiting_signatures: { title: "Upload final signed scan", helper: "Once fully signed, upload the executed .docx. This locks the agreement." }
};

export default function DocumentRepository({ record, user, onRecordChange, onError, onMessage }) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const uploadCopy = UPLOAD_COPY[record.status];
  const canUpload = user.role === "linkages" && Boolean(uploadCopy);
  const versions = [...(record.versions || [])].reverse();

  async function upload() {
    if (!file) return onError("Choose the .docx file to upload.");
    if (!file.name.toLowerCase().endsWith(".docx")) return onError("Only .docx files are accepted for agreement versions.");
    setSubmitting(true);
    try {
      const updated = await uploadAgreementDraft(record.id, file);
      onRecordChange(updated);
      setFile(null);
      onMessage(record.status === "awaiting_signatures" ? "Final signed scan uploaded. This agreement is now fully executed and locked." : "Draft uploaded.");
    } catch (error) {
      onError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel data-panel">
      <div className="panel-head">
        <div><h2>Version history</h2><p>Every upload creates a new version. Older versions stay visible, read-only, as superseded.</p></div>
      </div>
      <div className="document-list">
        {versions.map((version, index) => (
          <article className="document-row" key={version.id}>
            <span className="document-icon">{version.is_final ? <FileCheck2 /> : <FileText />}</span>
            <div>
              <strong>{index === 0 ? "Current version" : "Superseded version"}</strong>
              <span>Uploaded by {version.uploaded_by?.full_name || "Accord360"} · status at the time: {version.status_at_time}</span>
              <small>{formatDateTime(version.timestamp)}</small>
            </div>
            {version.is_final && <StatusBadge tone="green">Final, locked</StatusBadge>}
            <button className="icon-button" onClick={() => downloadAgreementVersion(record.id, version.id, `agreement-${record.id}-v${versions.length - index}.docx`).catch((error) => onError(error.message))} aria-label="Download this version"><Download size={18} /></button>
          </article>
        ))}
        {!versions.length && <EmptyState title="No versions yet" text="A version is created automatically once the Researcher's intake is submitted." />}
      </div>

      {canUpload && <div className="panel inset-panel">
        <div className="panel-head"><div><h2>{uploadCopy.title}</h2><p>{uploadCopy.helper}</p></div></div>
        <label className="upload-zone compact-upload"><UploadCloud /><strong>{file?.name || "Choose a .docx file"}</strong><span>Only Linkages can upload at this stage.</span><input type="file" accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <button className="primary-button" disabled={submitting || !file} onClick={upload}>{submitting ? "Uploading…" : "Upload"}</button>
      </div>}
    </section>
  );
}
