import { BellRing, BookOpen, Database, FileCheck2, Plus, Save, Scale, Settings2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { api } from "../lib/api";

const tabs = [
  ["agreement_types", "Agreement types", Database],
  ["documents", "Required documents", FileCheck2],
  ["scoring", "Scoring", Scale],
  ["sla", "Workflow & SLA", Settings2],
  ["notifications", "Notification rules", BellRing],
  ["templates", "Templates", BookOpen]
];

const emptyTemplate = { agreement_type: "MoU", name: "", version: "1.0", effective_date: "", description: "", status: "draft" };

export default function Configuration() {
  const [config, setConfig] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [tab, setTab] = useState(new URLSearchParams(window.location.search).get("tab") || "agreement_types");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError("");
    Promise.all([api("/configuration"), api("/templates")])
      .then(([configuration, templateData]) => { setConfig(configuration); setTemplates(templateData); })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => { load(); }, [load]);
  const weightTotal = useMemo(() => config?.scoring_weights?.reduce((sum, item) => sum + Number(item.weight), 0) || 0, [config]);

  if (error && !config) return <><PageHeader eyebrow="System administration" title="Configuration" /><ErrorState message={error} onRetry={load} /></>;
  if (!config) return <LoadingState label="Loading Accord360 configuration" />;

  async function save() {
    setSaving(true); setError("");
    try {
      const updated = await api("/configuration", { method: "PATCH", body: JSON.stringify(config) });
      setConfig(updated); setMessage("Configuration saved and audit event recorded.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  function addAgreementType() {
    const id = `type-${Date.now()}`;
    setConfig({
      ...config,
      agreement_types: [...config.agreement_types, { id, name: "New agreement type", abbreviation: "NEW", status: "draft", required_documents: 0, templates: 0 }]
    });
    setMessage("Draft agreement type added. Edit it, then save the configuration.");
  }

  function updateAgreementType(id, patch) {
    setConfig({ ...config, agreement_types: config.agreement_types.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function updateDocumentRule(agreementType, value) {
    const documents = value.split("\n").map((item) => item.trim()).filter(Boolean);
    setConfig({
      ...config,
      required_document_rules: config.required_document_rules.map((rule) => rule.agreement_type === agreementType ? { ...rule, documents } : rule)
    });
  }

  async function createTemplate() {
    if (!templateForm.name.trim() || !templateForm.version.trim()) { setError("Template name and version are required."); return; }
    setSaving(true); setError("");
    try {
      const created = await api("/templates", { method: "POST", body: JSON.stringify(templateForm) });
      setTemplates((current) => [...current, created]);
      setTemplateForm(emptyTemplate); setTemplateOpen(false); setMessage("New template version created as a draft.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function changeTemplateStatus(template, status) {
    setSaving(true); setError("");
    try {
      const updated = await api(`/templates/${template.id}`, { method: "PATCH", body: JSON.stringify({ status, effective_date: status === "active" ? template.effective_date || new Date().toISOString().slice(0, 10) : template.effective_date }) });
      setTemplates((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`Template ${status === "active" ? "published" : "retired"}.`);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader eyebrow="System administration" title="Configuration" description="Maintain agreement types, document rules, scoring weights, workflow SLAs, notifications and templates. Administrators cannot perform business approvals." actions={<button className="primary-button" disabled={saving || weightTotal !== 100} onClick={save}><Save size={17} /> {saving ? "Saving…" : "Save configuration"}</button>} />
      <nav className="settings-tabs">{tabs.map(([key, label, Icon]) => <button className={tab === key ? "active" : ""} onClick={() => setTab(key)} key={key}><Icon size={17} />{label}</button>)}</nav>

      {tab === "agreement_types" && (
        <section className="panel data-panel">
          <div className="panel-head"><div><h2>Agreement type configuration</h2><p>CA remains unpublished until its official definition is confirmed.</p></div><button className="secondary-button" onClick={addAgreementType}><Plus size={16} /> Add agreement type</button></div>
          <div className="table-wrap"><table><thead><tr><th>Name</th><th>Abbreviation</th><th>Status</th><th>Required documents</th><th>Templates</th><th>Actions</th></tr></thead><tbody>{config.agreement_types.map((item) => <tr key={item.id}><td data-label="Name"><input className="inline-input" value={item.name} onChange={(event) => updateAgreementType(item.id, { name: event.target.value })} /></td><td data-label="Abbreviation"><input className="inline-input compact-inline-input" value={item.abbreviation} onChange={(event) => updateAgreementType(item.id, { abbreviation: event.target.value.toUpperCase() })} /></td><td data-label="Status"><StatusBadge status={item.status} /></td><td data-label="Required documents">{config.required_document_rules.find((rule) => rule.agreement_type === item.abbreviation)?.documents.length || 0}</td><td data-label="Templates">{templates.filter((template) => template.agreement_type === item.abbreviation).length}</td><td data-label="Actions"><button className="text-button" onClick={() => updateAgreementType(item.id, { status: item.status === "active" ? "retired" : "active" })}>{item.status === "active" ? "Retire" : "Publish"}</button></td></tr>)}</tbody></table></div>
          <div className="form-alert warning">CA — Official definition pending stakeholder confirmation. New requests must not select CA until an approved title, document checklist and template are published.</div>
        </section>
      )}

      {tab === "documents" && (
        <section className="panel detail-main-card">
          <div className="panel-head"><div><h2>Required-document checklists</h2><p>One document per line. Request submission uses the active checklist for its agreement type.</p></div></div>
          <div className="document-rule-grid">{config.required_document_rules.map((rule) => <article key={rule.agreement_type}><div><StatusBadge tone="blue">{rule.agreement_type}</StatusBadge><strong>{rule.documents.length} required document{rule.documents.length === 1 ? "" : "s"}</strong></div><textarea rows="7" value={rule.documents.join("\n")} onChange={(event) => updateDocumentRule(rule.agreement_type, event.target.value)} /></article>)}</div>
        </section>
      )}

      {tab === "scoring" && (
        <section className="panel detail-main-card"><div className="panel-head"><div><h2>Collaboration score weights</h2><p>All active weights must total exactly 100%.</p></div><StatusBadge tone={weightTotal === 100 ? "green" : "red"}>{weightTotal}% total</StatusBadge></div><div className="weight-list">{config.scoring_weights.map((item) => <article key={item.key}><div><strong>{item.label}</strong><span>{item.key}</span></div><label><input type="number" min="0" max="100" value={item.weight} onChange={(event) => setConfig({ ...config, scoring_weights: config.scoring_weights.map((record) => record.key === item.key ? { ...record, weight: Number(event.target.value) } : record) })} /><span>%</span></label></article>)}</div>{weightTotal === 100 ? <div className="form-alert success"><ShieldCheck size={17} /> Weight configuration is valid.</div> : <div className="form-alert error">Active weights must total exactly 100% before saving.</div>}</section>
      )}

      {tab === "sla" && <section className="panel detail-main-card"><div className="panel-head"><div><h2>Workflow and SLA rules</h2><p>Stage targets drive overdue alerts and escalation.</p></div></div><div className="weight-list">{config.sla_rules.map((item) => <article key={item.stage}><div><strong>{item.stage.replaceAll("_", " ")}</strong><span>Business-day target</span></div><label><input type="number" min="1" value={item.days} onChange={(event) => setConfig({ ...config, sla_rules: config.sla_rules.map((record) => record.stage === item.stage ? { ...record, days: Number(event.target.value) } : record) })} /><span>days</span></label></article>)}</div></section>}

      {tab === "notifications" && <section className="panel detail-main-card"><div className="panel-head"><div><h2>Notification and escalation rules</h2><p>Configure expiry, dormancy and due-date reminder windows.</p></div></div><div className="form-grid"><label className="form-field"><span>Dormancy threshold (days)</span><input type="number" value={config.notification_rules.dormancy_days} onChange={(event) => setConfig({ ...config, notification_rules: { ...config.notification_rules, dormancy_days: Number(event.target.value) } })} /></label><label className="form-field"><span>Expiry reminder windows</span><input value={config.notification_rules.expiry_days.join(", ")} onChange={(event) => setConfig({ ...config, notification_rules: { ...config.notification_rules, expiry_days: event.target.value.split(",").map((value) => Number(value.trim())).filter(Boolean) } })} /></label><label className="form-field"><span>Due-date reminders</span><input value={config.notification_rules.reminder_days_before_due.join(", ")} onChange={(event) => setConfig({ ...config, notification_rules: { ...config.notification_rules, reminder_days_before_due: event.target.value.split(",").map((value) => Number(value.trim())).filter((value) => !Number.isNaN(value)) } })} /></label></div></section>}

      {tab === "templates" && (
        <section className="panel data-panel">
          <div className="panel-head"><div><h2>Approved template library</h2><p>Published templates are filtered by agreement type during request creation.</p></div><button className="secondary-button" onClick={() => setTemplateOpen(true)}><Plus size={16} /> Publish new version</button></div>
          <div className="template-grid">{templates.map((template) => <article className="template-card static" key={template.id}><div className="template-card-top"><BookOpen /><StatusBadge status={template.status} /></div><h3>{template.name}</h3><p>{template.description}</p><dl><div><dt>Type</dt><dd>{template.agreement_type}</dd></div><div><dt>Version</dt><dd>{template.version}</dd></div><div><dt>Owner</dt><dd>{template.owner}</dd></div></dl><button className="text-button" disabled={saving} onClick={() => changeTemplateStatus(template, template.status === "active" ? "retired" : "active")}>{template.status === "active" ? "Retire version" : "Publish version"}</button></article>)}</div>
        </section>
      )}

      <Modal open={templateOpen} onClose={() => setTemplateOpen(false)} title="Create template version" description="Create a draft template record. The template file and Legal publication approval must be completed before the version becomes available." footer={<><button className="secondary-button" onClick={() => setTemplateOpen(false)}>Cancel</button><button className="primary-button" disabled={saving} onClick={createTemplate}>{saving ? "Creating…" : "Create draft version"}</button></>}>
        <div className="form-grid"><label className="form-field"><span>Agreement type *</span><select value={templateForm.agreement_type} onChange={(event) => setTemplateForm({ ...templateForm, agreement_type: event.target.value })}>{config.agreement_types.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.abbreviation}>{item.abbreviation}</option>)}</select></label><label className="form-field"><span>Version *</span><input value={templateForm.version} onChange={(event) => setTemplateForm({ ...templateForm, version: event.target.value })} /></label><label className="form-field full-span"><span>Template name *</span><input value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} /></label><label className="form-field"><span>Effective date</span><input type="date" value={templateForm.effective_date} onChange={(event) => setTemplateForm({ ...templateForm, effective_date: event.target.value })} /></label><label className="form-field full-span"><span>Description</span><textarea rows="4" value={templateForm.description} onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })} /></label></div>
      </Modal>
    </>
  );
}
