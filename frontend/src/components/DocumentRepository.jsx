import { Download, FileCheck2, FileLock2, FileText, UploadCloud } from "lucide-react";
import { useState } from "react";
import { api, downloadFile } from "../lib/api";
import { formatDateTime } from "../lib/format";
import EmptyState from "./EmptyState";
import Modal from "./Modal";
import StatusBadge from "./StatusBadge";

const editableRoles = ["researcher", "approver", "linkages", "director_linkages", "legal", "vc_office", "me"];

export default function DocumentRepository({ record, user, onRecordChange, onError, onMessage }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ file: null, type: "Supporting document", confidentiality: "internal", description: "" });
  const canUpload = editableRoles.includes(user.role);

  async function upload() {
    if (!form.file) { onError("Choose a document to upload."); return; }
    setSubmitting(true);
    try {
      const created = await api(`/agreements/${record.id}/documents`, {
        method: "POST",
        body: JSON.stringify({
          name: form.file.name,
          size: form.file.size,
          mime_type: form.file.type,
          type: form.type,
          confidentiality: form.confidentiality,
          description: form.description
        })
      });
      onRecordChange({ ...record, documents: [...(record.documents || []), created] });
      setForm({ file: null, type: "Supporting document", confidentiality: "internal", description: "" });
      setUploadOpen(false);
      onMessage("Document uploaded and added to the agreement version history.");
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
          <div><h2>Document repository</h2><p>Standard templates, working drafts, approved versions and executed agreements remain distinct.</p></div>
          {canUpload && <button className="secondary-button compact-button" onClick={() => setUploadOpen(true)}><UploadCloud size={16} /> Upload document</button>}
        </div>
        <div className="document-list">
          {(record.documents || []).map((document) => (
            <article className="document-row" key={document.id}>
              <span className="document-icon">{document.status === "final_signed" ? <FileCheck2 /> : document.type === "Legal-approved draft" ? <FileLock2 /> : <FileText />}</span>
              <div><strong>{document.name}</strong><span>{document.type} · Version {document.version} · {document.confidentiality || "internal"}</span><small>Uploaded by {document.uploaded_by} on {formatDateTime(document.uploaded_at)}</small></div>
              <StatusBadge status={document.status} />
              <button className="icon-button" onClick={() => downloadFile(`/agreements/${record.id}/documents/${document.id}/download`, document.name).catch((error) => onError(error.message))} aria-label={`Download ${document.name}`}><Download size={18} /></button>
            </article>
          ))}
          {!record.documents?.length && <EmptyState title="No documents uploaded" text="Upload the first required or supporting document." />}
        </div>
      </section>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload agreement document"
        description="The file will be validated, scanned, classified and retained in the agreement version history."
        footer={<><button className="secondary-button" onClick={() => setUploadOpen(false)}>Cancel</button><button className="primary-button" disabled={submitting} onClick={upload}>{submitting ? "Uploading…" : "Upload document"}</button></>}
      >
        <div className="form-grid single-column">
          <label className="upload-zone compact-upload"><UploadCloud /><strong>{form.file?.name || "Choose document"}</strong><span>PDF, DOCX, XLSX or approved file type</span><input type="file" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} /></label>
          <label className="form-field"><span>Document type</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Supporting document</option><option>Working draft</option><option>Partner amendment</option><option>Legal-approved draft</option><option>Final signed agreement</option><option>Evidence</option></select></label>
          <label className="form-field"><span>Confidentiality</span><select value={form.confidentiality} onChange={(event) => setForm({ ...form, confidentiality: event.target.value })}><option value="public">Public</option><option value="partner_shared">Partner shared</option><option value="internal">Internal</option><option value="restricted">Restricted</option><option value="confidential">Confidential</option></select></label>
          <label className="form-field"><span>Description</span><textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        </div>
      </Modal>
    </>
  );
}
