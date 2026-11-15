import { BookOpen, ExternalLink, Search, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";

const articles = [
  { category: "Researcher", title: "Create a new agreement", text: "From My Agreements, click Create new agreement. Fill in the partner, department and dates — no document upload needed. Submitting sends your intake straight to Linkages, who prepares the actual draft." },
  { category: "Researcher", title: "Submit a quarterly progress update", text: "Open the agreement from your list and go to its Progress tab. Once the agreement is fully executed (or has expired while renewal is in progress), you can submit a quarter and notes there." },
  { category: "Linkages", title: "Upload the legal draft, corrected draft, or signed scan", text: "Open the agreement's Documents tab. Depending on its current status, you'll see the right upload prompt: the intake draft for Legal, a corrected draft after Legal returns it, or the final signed scan once it's ready — each upload moves the agreement to its next status." },
  { category: "Linkages", title: "Manage the MoU, CA and CRA templates", text: "Go to Templates to upload a new .docx, review its placeholder validation summary, and activate it. Only one template per document type can be active at a time. The Available tags panel lists every {{tag}} the Researcher's form can fill in." },
  { category: "Legal", title: "Comment on a draft", text: "Open the agreement's Legal review tab. You can add comments scoped to the current version, mark them resolved once addressed, and request corrections or approve the draft — visible immediately to Linkages." },
  { category: "M&E", title: "Update or archive an expired agreement", text: "Agreements that pass their end date without renewal are tagged Expired. From the Monitoring workspace, use Update to move it back into an active flow, or Archive if it's no longer being pursued. Nothing is ever archived automatically." },
  { category: "Workflow", title: "The nine agreement statuses", text: "Draft generated → Pending Legal review → Returned for corrections → Pending Legal verification → Approved for signing → Awaiting signatures → Fully executed → Expired → Archived. Each status only allows the actions relevant to whoever's turn it is." },
  { category: "Access", title: "Role-specific workspaces", text: "Accord360 only shows the navigation, actions and records relevant to your role: Researchers see only their own agreements; Linkages, Legal and M&E see everything." }
];

export default function Help() {
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const filtered = useMemo(() => articles.filter((item) => [item.category, item.title, item.text].some((value) => value.toLowerCase().includes(search.toLowerCase()))), [search]);
  return <>
    <PageHeader eyebrow="Help and guidance" title="Accord360 Help Centre" description="Find workflow guidance, role explanations, reporting help and frequently asked questions." />
    <div className="help-grid">
      <section className="help-library"><div className="panel help-search"><Search size={20} /><input placeholder="Search help articles…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="help-card-grid">{filtered.map((item) => <article className="panel help-card" key={item.title}><span className="help-icon"><BookOpen /></span><small>{item.category}</small><h2>{item.title}</h2><p>{item.text}</p><button className="text-link" onClick={() => setSelectedArticle(item)}>Read guidance <ExternalLink size={15} /></button></article>)}</div><section className="panel support-banner"><ShieldAlert /><div><h2>Need case-specific assistance?</h2><p>Escalate workflow or access questions to the Directorate of Linkages. Legal interpretation must remain with the University Legal Office.</p></div></section></section>
    </div>
    <Modal open={Boolean(selectedArticle)} onClose={() => setSelectedArticle(null)} title={selectedArticle?.title || "Help guidance"} description={selectedArticle?.category || "Accord360 Help Centre"} footer={<button className="primary-button" onClick={() => setSelectedArticle(null)}>Close</button>}>
      <p className="long-copy">{selectedArticle?.text}</p>
      <div className="form-alert info">This guidance describes the Accord360 workflow. Record-specific permissions and decisions remain controlled by the responsible JKUAT office.</div>
    </Modal>
  </>;
}