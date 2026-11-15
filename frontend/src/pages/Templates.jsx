import { AlertTriangle, CheckCircle2, Download, HelpCircle, ToggleLeft, ToggleRight, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { activateTemplate, createTemplate, deactivateTemplate, downloadTemplate, listFieldDefinitions, listTemplates } from "../lib/backend.js";

const DOCUMENT_TYPES = ["MoU", "CRA", "CA", "Other"];

// GOOGLE_DOCS_DRAFTING_BRIEF.md Section 4 — accepts either a bare Doc id or
// a full docs.google.com/.../d/<id>/edit URL and pulls out the id.
function parseGoogleDocId(value) {
  const trimmed = (value || "").trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

export default function Templates() {
  const [templates, setTemplates] = useState(null);
  const [fields, setFields] = useState([]);
  const [documentType, setDocumentType] = useState("MoU");
  const [customType, setCustomType] = useState("");
  const [file, setFile] = useState(null);
  const [masterDocInput, setMasterDocInput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [templateList, definitions] = await Promise.all([listTemplates({ includeArchived: true }), listFieldDefinitions()]);
      setTemplates(templateList);
      setFields(definitions);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function upload(event) {
    event.preventDefault();
    const resolvedType = documentType === "Other" ? customType.trim() : documentType;
    if (!resolvedType) return setError("Enter a document type.");
    const master_doc_id = parseGoogleDocId(masterDocInput);
    if (!master_doc_id) return setError("Paste the Google Doc link or id for the master template.");
    setSubmitting(true);
    setError("");
    try {
      const created = await createTemplate({ document_type: resolvedType, master_doc_id, file: file || undefined });
      setTemplates((current) => [created, ...current]);
      setFile(null);
      setMasterDocInput("");
      setMessage(`${created.document_type} template created. Activate it once you're ready for Researchers to use it.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(template) {
    setError("");
    try {
      const updated = template.is_active ? await deactivateTemplate(template.id) : await activateTemplate(template.id);
      setTemplates((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`${updated.document_type} template ${updated.is_active ? "activated" : "deactivated"}.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (!templates) return <PageHeader eyebrow="Templates" title="MoU, CA and CRA templates" />;

  const groups = templates.reduce((acc, template) => {
    (acc[template.document_type] ||= []).push(template);
    return acc;
  }, {});
  const groupOrder = [...DOCUMENT_TYPES.filter((type) => type !== "Other"), ...Object.keys(groups).filter((type) => !DOCUMENT_TYPES.includes(type)), "Other"].filter((type) => groups[type]?.length);

  return <>
    <Toast message={message} onClose={() => setMessage("")} />
    <Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Templates" title="MoU, CA and CRA templates" description="Link a Google Doc master template, then activate it. Exactly one active template per document type is what Researchers copy to start a new agreement." />

    <div className="detail-grid">
      <section className="panel detail-main-card">
        <div className="panel-head"><div><h2>Add a template</h2></div></div>
        <form className="form-grid" onSubmit={upload}>
          <label className="form-field"><span>Document type *</span>
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
              {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          {documentType === "Other" && <label className="form-field"><span>Type name *</span><input value={customType} onChange={(event) => setCustomType(event.target.value)} placeholder="e.g. Research Collaboration Agreement" /></label>}
          <label className="form-field span-2">
            <span>Google Doc master template *</span>
            <input
              value={masterDocInput}
              onChange={(event) => setMasterDocInput(event.target.value)}
              placeholder="Paste the docs.google.com link or Doc id"
            />
            <small>Share this Doc with the Accord 360 service account as Editor first. This is what Researchers actually copy — a template can't be activated without it.</small>
          </label>
          <label className="form-field span-2">
            <span>Reference file (optional)</span>
            <label className="upload-zone compact-upload">
              <UploadCloud />
              <strong>{file?.name || "Choose a file"}</strong>
              <span>A copy for Linkages' own records. Accord 360 never reads or renders it.</span>
              <input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
          </label>
          <button className="primary-button" disabled={submitting} type="submit">{submitting ? "Saving…" : "Add template"}</button>
        </form>
      </section>

      <aside className="panel detail-side-card">
        <div className="panel-head"><div><h2><HelpCircle size={16} /> Structured intake fields</h2></div></div>
        {showGuide
          ? <div className="table-wrap"><table><thead><tr><th>Field</th><th>Required</th></tr></thead><tbody>{fields.map((field) => <tr key={field.id}><td>{field.label}</td><td>{field.required ? "Yes" : "No"}</td></tr>)}</tbody></table></div>
          : <p className="helper-note">These are the data fields the Researcher's intake form collects alongside the Google Doc — used for expiry alerts, M&E tracking and the dashboard. <button type="button" className="text-link" onClick={() => setShowGuide(true)}>Show the full list</button></p>}
      </aside>
    </div>

    {groupOrder.map((type) => (
      <section className="panel data-panel" key={type}>
        <div className="panel-head"><div><h2>{type}</h2><p>{groups[type].filter((t) => t.is_active).length ? "One active template" : "No active template yet"}</p></div></div>
        <div className="document-list">
          {groups[type].map((template) => (
            <article className="document-row" key={template.id}>
              <span className="document-icon">{template.is_active ? <CheckCircle2 /> : <AlertTriangle />}</span>
              <div>
                <strong>{template.document_type}</strong>
                <span>Added by {template.uploaded_by?.full_name || "Accord360"}</span>
                {!template.master_doc_id && <small>No Google Doc linked — Researchers can't use this template yet</small>}
              </div>
              <StatusBadge tone={template.is_active ? "green" : "slate"}>{template.is_active ? "Active" : "Inactive"}</StatusBadge>
              {template.file && <button className="icon-button" onClick={() => downloadTemplate(template.id, template.file.split("/").pop()).catch((requestError) => setError(requestError.message))} aria-label="Download reference file"><Download size={18} /></button>}
              <button className="secondary-button compact-button" onClick={() => toggleActive(template)}>
                {template.is_active ? <><ToggleRight size={16} /> Deactivate</> : <><ToggleLeft size={16} /> Activate</>}
              </button>
            </article>
          ))}
        </div>
      </section>
    ))}
    {!groupOrder.length && <section className="panel data-panel"><p className="empty-state">No templates have been added yet.</p></section>}
  </>;
}
