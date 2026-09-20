import { BellRing, BookOpen, Database, FileCheck2, LockKeyhole, Save, Settings2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { activateTemplate, createTemplate, deactivateTemplate, listFieldDefinitions, listTemplates, listConfiguration, updateConfiguration, listReferenceData } from "../lib/backend.js";

const tabs = [
  ["agreement_types", "Agreement types", Database],
  ["documents", "Documents", FileCheck2],
  ["sla", "Workflow & SLA", Settings2],
  ["notifications", "Notifications", BellRing],
  ["templates", "Templates", BookOpen],
  ["authoring_guide", "Authoring guide", BookOpen]
];

const documentRules = [
  "The backend accepts PDF, DOC, DOCX, XLS, XLSX, CSV, PNG, JPG, JPEG and TXT.",
  "The maximum upload size is 25 MB.",
  "Confidentiality values are public, internal and confidential.",
  "Document type, version and official status are supplied with multipart/form-data."
];

export default function Configuration() {
  const [tab, setTab] = useState(new URLSearchParams(window.location.search).get("tab") || "agreement_types");
  const [templates, setTemplates] = useState([]);
  const [fields, setFields] = useState([]);
  const [referenceData, setReferenceData] = useState([]);
  const [configuration, setConfiguration] = useState([]);
  const [templateForm, setTemplateForm] = useState({ document_type: "Standard MoU", file: null });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [templateList, definitions, references] = await Promise.all([listTemplates({ includeArchived: true }), listFieldDefinitions(), listReferenceData()]);
      setTemplates(templateList);
      setFields(definitions);
      setReferenceData(references);
    } catch (requestError) {
      setError(requestError.message);
    }
    try {
      setConfiguration(await listConfiguration());
    } catch (requestError) {
      if (!requestError.message.includes("permission")) setError(requestError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function publishTemplate(event) {
    event.preventDefault();
    if (!templateForm.file) return setError("Choose a .docx template.");
    setSubmitting(true);
    try {
      const created = await createTemplate(templateForm);
      setTemplates((current) => [...current, created]);
      setTemplateForm({ document_type: "Standard MoU", file: null });
      setMessage(created.validated ? "Template uploaded and validated." : "Template uploaded; review the validation summary.");
    } catch (requestError) { setError(requestError.message); } finally { setSubmitting(false); }
  }

  async function archiveTemplate(template) {
    try {
      const updated = template.is_active ? await deactivateTemplate(template.id) : await activateTemplate(template.id);
      setTemplates((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`Template ${updated.is_active ? "activated" : "deactivated"}.`);
    } catch (requestError) { setError(requestError.message); }
  }

  async function saveConfiguration(item, value) {
    try {
      const updated = await updateConfiguration(item.key, { value });
      setConfiguration((current) => current.map((entry) => entry.key === updated.key ? updated : entry));
      setMessage(`${item.key} updated.`);
    } catch (requestError) { setError(requestError.message); }
  }

  return <>
    <Toast message={message} onClose={() => setMessage("")} />
    <Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="System administration" title="Configuration and libraries" description="Templates, reference data and editable operational values are now loaded from the backend." meta={<span className="scope-note"><ShieldCheck size={15} /> Admin-managed controls</span>} />
    <div className="inline-alert"><LockKeyhole size={18} /><div><strong>Changes are audited</strong><p>Template publication, archival and configuration changes are restricted by backend roles and recorded in the audit log.</p></div></div>
    <nav className="settings-tabs" aria-label="Configuration categories">{tabs.map(([key, label, Icon]) => <button type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)} key={key}><Icon size={17} />{label}</button>)}</nav>

    {tab === "agreement_types" && <section className="panel data-panel"><div className="panel-head"><div><h2>Configured agreement types</h2><p>Reference data is authenticated and can be managed by an administrator.</p></div><StatusBadge tone="green">Backend controlled</StatusBadge></div>{referenceData.filter((item) => item.category === "agreement_type").length ? <div className="table-wrap"><table><thead><tr><th>Label</th><th>Code</th><th>Value</th><th>Status</th></tr></thead><tbody>{referenceData.filter((item) => item.category === "agreement_type").map((item) => <tr key={item.id}><td>{item.label}</td><td><code>{item.code}</code></td><td>{item.value || "—"}</td><td><StatusBadge tone="green">Active</StatusBadge></td></tr>)}</tbody></table></div> : <p className="empty-state">No agreement-type reference data has been configured yet. The API contract still accepts MoU, CRA, CA and Other.</p>}</section>}
    {tab === "documents" && <section className="panel"><div className="panel-head"><div><h2>Implemented document contract</h2><p>These rules are enforced by POST /agreements/:id/documents.</p></div><StatusBadge tone="green">Implemented</StatusBadge></div><ul className="guidance-list">{documentRules.map((item) => <li key={item}>{item}</li>)}</ul></section>}
    {(tab === "sla" || tab === "notifications") && <section className="panel"><div className="panel-head"><div><h2>{tab === "sla" ? "Workflow and SLA values" : "Notification configuration"}</h2><p>Editable values are stored as audited configuration keys.</p></div><StatusBadge tone="green">Backend managed</StatusBadge></div>{configuration.filter((item) => item.category === tab || item.category === "general").map((item) => <div className="configuration-row" key={item.key}><div><strong>{item.key}</strong><p>{item.description || "No description"}</p></div><div className="configuration-editor"><input defaultValue={item.value} disabled={!item.is_editable} id={`config-${item.key}`} /><button className="secondary-button" disabled={!item.is_editable} onClick={() => saveConfiguration(item, document.getElementById(`config-${item.key}`).value)}><Save size={15} /> Save</button></div></div>)}{!configuration.length && <p className="empty-state">No configuration values are available, or this account is not an administrator.</p>}</section>}
    {tab === "templates" && <section className="panel"><div className="panel-head"><div><h2>Template library</h2><p>Upload .docx templates, inspect placeholder validation, and activate one template per document type.</p></div><StatusBadge tone="green">Linkages managed</StatusBadge></div><form className="form-grid inset-panel" onSubmit={publishTemplate}><label className="form-field"><span>Document type *</span><input value={templateForm.document_type} onChange={(event) => setTemplateForm({ ...templateForm, document_type: event.target.value })} /></label><label className="form-field"><span>Template file *</span><input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setTemplateForm({ ...templateForm, file: event.target.files?.[0] || null })} /></label><button className="primary-button" disabled={submitting} type="submit">{submitting ? "Validating…" : "Upload and validate"}</button></form><div className="version-list">{templates.map((template) => <article key={template.id}><div><strong>{template.document_type}</strong><small>{template.is_active ? "Active" : "Inactive"} · {template.file}</small><small>Present: {template.present?.join(", ") || "None"}</small><small>Missing required: {template.missing_required?.join(", ") || "None"} · Unknown: {template.unknown_tokens?.join(", ") || "None"}</small></div><button className="secondary-button" onClick={() => archiveTemplate(template)}>{template.is_active ? "Deactivate" : "Activate"}</button></article>)}{!templates.length && <p className="empty-state">No templates have been uploaded yet.</p>}</div></section>}
    {tab === "authoring_guide" && <section className="panel"><div className="panel-head"><div><h2>Template authoring guide</h2><p>Use each placeholder exactly as shown in the active document template.</p></div></div><div className="table-wrap"><table><thead><tr><th>Field</th><th>Placeholder</th><th>Label</th><th>Required</th></tr></thead><tbody>{fields.map((field) => <tr key={field.id}><td>{field.field_name}</td><td><code>{`{{${field.field_name}}}`}</code></td><td>{field.label}</td><td>{field.required ? "Yes" : "No"}</td></tr>)}</tbody></table></div>{!fields.length && <p className="empty-state">No FieldDefinition rows are configured.</p>}</section>}
  </>;
}
