import { BellRing, BookOpen, Database, FileCheck2, LockKeyhole, Save, Settings2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { createTemplate, listTemplates, updateTemplate, listConfiguration, updateConfiguration, listReferenceData } from "../lib/backend.js";

const tabs = [
  ["agreement_types", "Agreement types", Database],
  ["documents", "Documents", FileCheck2],
  ["sla", "Workflow & SLA", Settings2],
  ["notifications", "Notifications", BellRing],
  ["templates", "Templates", BookOpen]
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
  const [referenceData, setReferenceData] = useState([]);
  const [configuration, setConfiguration] = useState([]);
  const [templateForm, setTemplateForm] = useState({ name: "", agreement_type: "MoU", version: "1.0", description: "", file: null });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [templateList, references] = await Promise.all([listTemplates({ includeArchived: true }), listReferenceData()]);
      setTemplates(templateList);
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
    if (!templateForm.name.trim()) return setError("Template name is required.");
    setSubmitting(true);
    try {
      const created = await createTemplate({ ...templateForm, name: templateForm.name.trim() });
      setTemplates((current) => [...current, created]);
      setTemplateForm({ name: "", agreement_type: "MoU", version: "1.0", description: "", file: null });
      setMessage("Template published to the backend library.");
    } catch (requestError) { setError(requestError.message); } finally { setSubmitting(false); }
  }

  async function archiveTemplate(template) {
    try {
      const updated = await updateTemplate(template.id, { status: template.status === "archived" ? "active" : "archived" });
      setTemplates((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`Template ${updated.status === "archived" ? "archived" : "restored"}.`);
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
    {tab === "templates" && <section className="panel"><div className="panel-head"><div><h2>Template library</h2><p>Publish versioned templates for use in the agreement request wizard.</p></div><StatusBadge tone="green">Implemented</StatusBadge></div><form className="form-grid inset-panel" onSubmit={publishTemplate}><label className="form-field"><span>Name *</span><input value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} /></label><label className="form-field"><span>Agreement type *</span><select value={templateForm.agreement_type} onChange={(event) => setTemplateForm({ ...templateForm, agreement_type: event.target.value })}><option>MoU</option><option>CRA</option><option>CA</option><option>Other</option></select></label><label className="form-field"><span>Version *</span><input value={templateForm.version} onChange={(event) => setTemplateForm({ ...templateForm, version: event.target.value })} /></label><label className="form-field"><span>File</span><input type="file" accept=".doc,.docx,.odt,.pdf" onChange={(event) => setTemplateForm({ ...templateForm, file: event.target.files?.[0] || null })} /></label><label className="form-field span-2"><span>Description</span><textarea rows="2" value={templateForm.description} onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })} /></label><button className="primary-button" disabled={submitting} type="submit">{submitting ? "Publishing…" : "Publish template"}</button></form><div className="version-list">{templates.map((template) => <article key={template.id}><div><strong>{template.name}</strong><small>{template.agreement_type} · Version {template.version} · {template.status}</small></div><button className="secondary-button" onClick={() => archiveTemplate(template)}>{template.status === "archived" ? "Restore" : "Archive"}</button></article>)}{!templates.length && <p className="empty-state">No templates have been published yet.</p>}</div></section>}
  </>;
}
