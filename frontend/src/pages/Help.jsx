import { BookOpen, ExternalLink, Search, ShieldAlert } from "lucide-react";
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