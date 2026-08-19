import { Download, FileCheck2, FileLock2, FileText, UploadCloud } from "lucide-react";
import { useState } from "react";
import { downloadAgreementDocument, getAgreement, uploadAgreementDocument } from "../lib/backend.js";
import { formatDateTime } from "../lib/format.js";
import EmptyState from "./EmptyState.jsx";
import Modal from "./Modal.jsx";
import StatusBadge from "./StatusBadge.jsx";

const uploadRoles = ["researcher", "linkages", "director_linkages", "legal", "vc_office", "me"];
const allowedExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "png", "jpg", "jpeg", "txt"];

export default function DocumentRepository({ record, user, onRecordChange, onError, onMessage }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ file: null, documentType: "supporting", version: "1.0", confidentiality: "internal", isOfficial: false });
  const canUpload = uploadRoles.includes(user.role) && record.backend_stage !== "archived";

  async function upload() {
    if (!form.file) {
      onError("Choose a document to upload.");
      return;
    }
    const extension = form.file.name.split(".").pop()?.toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      onError(`.${extension || "unknown"} is not an allowed file type.`);
      return;
    }
    if (form.file.size > 25 * 1024 * 1024) {
      onError("The selected file exceeds the backend 25 MB limit.");
      return;
    }
    setSubmitting(true);
    try {
      await uploadAgreementDocument(record.id, form);
      const refreshed = await getAgreement(record.id);
      onRecordChange(refreshed);
      setForm({ file: null, documentType: "supporting", version: "1.0", confidentiality: "internal", isOfficial: false });
      setUploadOpen(false);
      onMessage("Document uploaded through the implemented multipart endpoint.");
    } catch (error) {
      onError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="panel data-panel">
        <div className="panel-head">
          <div><h2>Document repository</h2><p>Files are loaded from the agreement detail response and downloaded with bearer-token authorization.</p></div>
          {canUpload && <button className="secondary-button compact-button" onClick={() => setUploadOpen(true)}><UploadCloud size={16} /> Upload document</button>}
        </div>
        <div className="document-list">
          {(record.documents || []).map((document) => (
            <article className="document-row" key={document.id}>
              <span className="document-icon">{document.status === "final_signed" ? <FileCheck2 /> : document.is_official ? <FileLock2 /> : <FileText />}</span>
              <div><strong>{document.name}</strong><span>{document.type} · Version {document.version} · {document.confidentiality}</span><small>Uploaded {formatDateTime(document.uploaded_at)} · {Math.ceil(Number(document.size || 0) / 1024)} KB</small></div>
              <StatusBadge status={document.status} />
              <button className="icon-button" onClick={() => downloadAgreementDocument(record.id, document.id, document.name).catch((error) => onError(error.message))} aria-label={`Download ${document.name}`}><Download size={18} /></button>
            </article>
          ))}
          {!record.documents?.length && <EmptyState title="No documents uploaded" text="Upload the first required or supporting document." />}
        </div>
      </section>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload agreement document"
        description="This form uses POST /agreements/{agreement_id}/documents with multipart/form-data."
        footer={<><button className="secondary-button" onClick={() => setUploadOpen(false)}>Cancel</button><button className="primary-button" disabled={submitting} onClick={upload}>{submitting ? "Uploading…" : "Upload document"}</button></>}
      >
        <div className="form-grid single-column">
          <label className="upload-zone compact-upload"><UploadCloud /><strong>{form.file?.name || "Choose document"}</strong><span>Allowed types from API contract · maximum 25 MB</span><input type="file" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} /></label>
          <label className="form-field"><span>Document type</span><select value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })}><option value="supporting">Supporting</option><option value="working_draft">Working draft</option><option value="partner_amendment">Partner amendment</option><option value="legal_approved">Legal-approved draft</option><option value="signed">Signed agreement</option><option value="evidence">M&E evidence</option></select></label>
          <label className="form-field"><span>Version</span><input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></label>
          <label className="form-field"><span>Confidentiality</span><select value={form.confidentiality} onChange={(event) => setForm({ ...form, confidentiality: event.target.value })}><option value="public">Public</option><option value="internal">Internal</option><option value="confidential">Confidential</option></select></label>
          <label className="consent-box"><input type="checkbox" checked={form.isOfficial} onChange={(event) => setForm({ ...form, isOfficial: event.target.checked })} /><span>Mark as official. Use this only for approved or fully signed institutional documents.</span></label>
        </div>
      </Modal>
    </>
  );
}
