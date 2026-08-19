import { Bot, BookOpen, ExternalLink, HelpCircle, MessageCircle, Search, Send, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";

const articles = [
  { category: "Getting started", title: "Create a partnership request", text: "Select a partner, agreement type, JKUAT ownership, approved template and required documents before submission." },
  { category: "Corrections & returns", title: "Respond to a structured correction", text: "Open the correction record, follow the deep link to the exact item, submit a response and attach replacement evidence." },
  { category: "Legal review", title: "Understand blocking Legal comments", text: "Legal approval remains unavailable while unresolved blocking comments exist." },
  { category: "Governance", title: "DVC RPE and VC responsibilities", text: "DVC RPE endorses the legally approved package. The VC Office receives the complete package and tracks execution." },
  { category: "Monitoring & reporting", title: "Submit a six-month Champion report", text: "Update activities, outputs, challenges, value, evidence and renewal recommendation, then submit to Linkages." },
  { category: "Access", title: "Role-specific workspaces", text: "Accord360 only displays navigation, actions and records relevant to the signed-in user's role and organization scope." }
];

export default function Help() {
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState([{ id: 1, role: "assistant", text: "Hello. I can explain Accord360 workflows, statuses, required documents and reporting steps. I cannot give legal advice or approve records." }]);
  const [input, setInput] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const filtered = useMemo(() => articles.filter((item) => [item.category, item.title, item.text].some((value) => value.toLowerCase().includes(search.toLowerCase()))), [search]);
  function ask(event) {
    event.preventDefault();
    if (!input.trim()) return;
    const question = input.trim();
    const lower = question.toLowerCase();
    let answer = "Open the relevant record and use its current stage, responsible office and required next action. For case-specific institutional guidance, escalate to the Directorate of Linkages.";
    if (lower.includes("template") || lower.includes("document")) answer = "Create or open a request, select the agreement type, choose an active approved template, then complete the dynamic document checklist. Submission is blocked while mandatory documents are missing.";
    if (lower.includes("legal")) answer = "Legal reviews the working draft, comments at clause level and returns issues to Linkages. A legally approved version is locked before DVC RPE endorsement. This is system guidance, not legal advice.";
    if (lower.includes("dvc") || lower.includes("vc")) answer = "The required sequence is Legal approval, legal version lock, DVC RPE endorsement, VC submission, JKUAT signature, partner signature, final signed PDF and activation.";
    if (lower.includes("report") || lower.includes("m&e")) answer = "Active agreements generate recurring six-month Champion reports. Linkages or M&E validates activities, outputs, challenges, evidence and recorded resource value.";
    setMessages((current) => [...current, { id: Date.now(), role: "user", text: question }, { id: Date.now() + 1, role: "assistant", text: answer }]);
    setInput("");
  }
  return <>
    <PageHeader eyebrow="Help and guidance" title="Accord360 Help Centre" description="Find workflow guidance, role explanations, reporting help and frequently asked questions." />
    <div className="help-grid">
      <section className="help-library"><div className="panel help-search"><Search size={20} /><input placeholder="Search help articles…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="help-card-grid">{filtered.map((item) => <article className="panel help-card" key={item.title}><span className="help-icon"><BookOpen /></span><small>{item.category}</small><h2>{item.title}</h2><p>{item.text}</p><button className="text-link" onClick={() => setSelectedArticle(item)}>Read guidance <ExternalLink size={15} /></button></article>)}</div><section className="panel support-banner"><ShieldAlert /><div><h2>Need case-specific assistance?</h2><p>Escalate workflow or access questions to the Directorate of Linkages. Legal interpretation must remain with the University Legal Office.</p></div><button className="secondary-button" onClick={() => { setInput("I need case-specific Linkages support with this record."); setMessages((current) => [...current, { id: Date.now(), role: "assistant", text: "Describe the record reference and workflow issue without sharing passwords or confidential document contents. Accord360 will route the support request to an authorized Linkages officer." }]); }}>Escalate to Linkages support</button></section></section>
      <aside className="panel help-assistant"><div className="assistant-head"><span><Bot /></span><div><h2>Accord360 Help Assistant</h2><p>System guidance only · not legal advice</p></div></div><div className="chat-messages">{messages.map((message) => <div className={`chat-message ${message.role}`} key={message.id}>{message.role === "assistant" && <Bot size={16} />}<p>{message.text}</p></div>)}</div><div className="suggested-questions"><button onClick={() => setInput("What documents are required?")}>Required documents</button><button onClick={() => setInput("What happens after Legal review?")}>After Legal review</button><button onClick={() => setInput("How do six-month reports work?")}>Six-month reports</button></div><form className="chat-input" onSubmit={ask}><MessageCircle size={18} /><input placeholder="Ask a workflow question…" value={input} onChange={(event) => setInput(event.target.value)} /><button aria-label="Send question"><Send size={18} /></button></form></aside>
    </div>
    <Modal open={Boolean(selectedArticle)} onClose={() => setSelectedArticle(null)} title={selectedArticle?.title || "Help guidance"} description={selectedArticle?.category || "Accord360 Help Centre"} footer={<button className="primary-button" onClick={() => setSelectedArticle(null)}>Close</button>}>
      <p className="long-copy">{selectedArticle?.text}</p>
      <div className="form-alert info">This guidance describes the Accord360 workflow. Record-specific permissions and decisions remain controlled by the responsible JKUAT office.</div>
    </Modal>
  </>;
}
