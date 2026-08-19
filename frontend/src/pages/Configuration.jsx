import { BellRing, BookOpen, Database, FileCheck2, LockKeyhole, Scale, Settings2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { BACKEND_CAPABILITIES } from "../lib/backend.js";

const tabs = [
  ["agreement_types", "Agreement types", Database],
  ["documents", "Documents", FileCheck2],
  ["scoring", "Scoring", Scale],
  ["sla", "Workflow & SLA", Settings2],
  ["notifications", "Notifications", BellRing],
  ["templates", "Templates", BookOpen]
];

const agreementTypes = [
  { name: "Memorandum of Understanding", abbreviation: "MoU", selectable: true },
  { name: "Collaborative Research Agreement", abbreviation: "CRA", selectable: true },
  { name: "CA — definition pending stakeholder confirmation", abbreviation: "CA", selectable: true },
  { name: "Other configured agreement", abbreviation: "Other", selectable: true }
];

const documentRules = [
  "The backend accepts PDF, DOC, DOCX, XLS, XLSX, CSV, PNG, JPG, JPEG and TXT.",
  "The maximum upload size is 25 MB.",
  "Confidentiality values are public, internal and confidential.",
  "Document type, version and official status are supplied with multipart/form-data."
];

export default function Configuration() {
  const [tab, setTab] = useState(new URLSearchParams(window.location.search).get("tab") || "agreement_types");

  return <>
    <PageHeader
      eyebrow="System administration"
      title="Configuration readiness"
      description="The current backend does not expose configuration or template-management endpoints. This page documents the implemented contract without sending unsupported requests."
      meta={<span className="scope-note"><ShieldCheck size={15} /> No business approval actions</span>}
    />
    <div className="inline-alert warning"><LockKeyhole size={18} /><div><strong>Backend implementation required</strong><p>Configuration, template library, SLA rules, notification rules and persisted score weights remain read-only until matching API routes are added.</p></div></div>
    <nav className="settings-tabs" aria-label="Configuration categories">{tabs.map(([key, label, Icon]) => <button type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)} key={key}><Icon size={17} />{label}</button>)}</nav>

    {tab === "agreement_types" && <section className="panel data-panel"><div className="panel-head"><div><h2>Backend agreement types</h2><p>POST /agreements currently accepts these exact values.</p></div><StatusBadge tone="blue">API controlled</StatusBadge></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>API value</th><th>Availability</th></tr></thead><tbody>{agreementTypes.map((item) => <tr key={item.abbreviation}><td data-label="Name">{item.name}</td><td data-label="API value"><code>{item.abbreviation}</code></td><td data-label="Availability"><StatusBadge tone={item.selectable ? "green" : "orange"}>{item.selectable ? "Accepted" : "Pending"}</StatusBadge></td></tr>)}</tbody></table></div><p className="form-help">MoA is not accepted by the current backend schema. It must not be sent until the backend contract is updated.</p></section>}

    {tab === "documents" && <section className="panel"><div className="panel-head"><div><h2>Implemented document contract</h2><p>These rules are enforced by POST /agreements/:id/documents.</p></div><StatusBadge tone="green">Implemented</StatusBadge></div><ul className="guidance-list">{documentRules.map((item) => <li key={item}>{item}</li>)}</ul></section>}

    {tab === "scoring" && <section className="panel"><div className="panel-head"><div><h2>Collaboration scoring</h2><p>The UI calculates a transparent preview from deliverables, evidence, status and value records.</p></div><StatusBadge tone={BACKEND_CAPABILITIES.scorecards ? "green" : "orange"}>{BACKEND_CAPABILITIES.scorecards ? "Persisted" : "Frontend preview"}</StatusBadge></div><div className="score-weight-grid"><article><span>Deliverable achievement</span><strong>50%</strong></article><article><span>Evidence completeness</span><strong>20%</strong></article><article><span>Compliance and timeliness</span><strong>20%</strong></article><article><span>Financial/resource value</span><strong>10%</strong></article></div><p className="form-help">Total weight: 100%. The score is not stored because no scorecard endpoint is implemented.</p></section>}

    {tab === "sla" && <section className="panel"><div className="panel-head"><div><h2>Workflow and SLA ownership</h2><p>Stage transitions are controlled by POST /agreements/:id/transition.</p></div><StatusBadge tone="green">Backend enforced</StatusBadge></div><p>Legal-review escalation, expiry warnings and 180-day dormancy rules are calculated by the backend. There is currently no API for administrators to change those thresholds.</p></section>}

    {tab === "notifications" && <section className="panel"><div className="panel-head"><div><h2>Notification rules</h2><p>Users can read their latest 50 notifications and mark individual items as read.</p></div><StatusBadge tone="green">Partially implemented</StatusBadge></div><p>Email delivery configuration, resend operations and notification-rule editing are not exposed by the current API.</p></section>}

    {tab === "templates" && <section className="panel"><div className="panel-head"><div><h2>Template library</h2><p>The request wizard may show local guidance, but it does not claim to save or publish templates.</p></div><StatusBadge tone="orange">API pending</StatusBadge></div><p>No GET, POST or PATCH template routes are currently implemented. Template selection is therefore descriptive frontend metadata only and is not submitted as a backend field.</p></section>}
  </>;
}
