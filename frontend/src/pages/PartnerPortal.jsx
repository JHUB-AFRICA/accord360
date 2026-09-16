import { Building2, Download, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { downloadPartnerDocument, getPartnerWorkspace, getPartnerAgreement, listPartnerAgreements } from "../lib/backend.js";

export default function PartnerPortal() {
  const [workspace, setWorkspace] = useState(null);
  const [agreements, setAgreements] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [profile, records] = await Promise.all([getPartnerWorkspace(), listPartnerAgreements()]);
      setWorkspace(profile);
      setAgreements(records);
    } catch (requestError) { setError(requestError.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openAgreement(item) {
    try { setSelected(await getPartnerAgreement(item.id)); }
    catch (requestError) { setError(requestError.message); }
  }

  async function download(document) {
    try { await downloadPartnerDocument(selected.id, document.id, document.original_name); setMessage("Document download started."); }
    catch (requestError) { setError(requestError.message); }
  }

  if (error && !workspace) return <><PageHeader eyebrow="Partner workspace" title="Unable to load workspace" /><ErrorState message={error} onRetry={load} /></>;
  if (!workspace || !agreements) return <LoadingState label="Loading partner workspace" />;

  return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="External partner workspace" title={workspace.partner.name} description={`${workspace.user.full_name} · ${workspace.partner.country}`} meta={<StatusBadge tone="green">Active organization access</StatusBadge>} />
    <section className="kpi-grid"><article className="kpi-card tone-blue"><Building2 /><div><span>Organization</span><strong>{workspace.partner.partner_type}</strong></div></article><article className="kpi-card tone-green"><FileText /><div><span>Shared agreements</span><strong>{agreements.length}</strong></div></article><article className="kpi-card tone-purple"><ShieldCheck /><div><span>Access scope</span><strong>Partner records only</strong></div></article></section>
    {selected ? <section className="panel"><div className="panel-head"><div><h2>{selected.title}</h2><p>{selected.reference_number} · {selected.agreement_type} · {selected.purpose}</p></div><button className="secondary-button" onClick={() => setSelected(null)}>Back to agreements</button></div><div className="version-list">{selected.documents.map((document) => <article key={document.id}><div><strong>{document.original_name}</strong><small>{document.document_type} · Version {document.version} · {document.size_bytes.toLocaleString()} bytes</small></div><button className="secondary-button" onClick={() => download(document)}><Download size={15} /> Download</button></article>)}{!selected.documents.length && <p className="empty-state">No documents have been shared with your organization.</p>}</div></section> : <section className="panel"><div className="panel-head"><div><h2>Shared agreements</h2><p>Only records linked to your organization are visible here.</p></div><StatusBadge tone="green">Backend scoped</StatusBadge></div>{agreements.length ? <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Agreement</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>{agreements.map((item) => <tr key={item.id}><td><strong>{item.reference_number}</strong></td><td>{item.title}<small>{item.agreement_type}</small></td><td><StatusBadge status={item.status}>{item.status}</StatusBadge></td><td>{new Date(item.updated_at).toLocaleDateString()}</td><td><button className="text-link" onClick={() => openAgreement(item)}>View shared record</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><LockKeyhole size={28} /><h2>No shared agreements yet</h2><p>Your JKUAT contact will share agreement records here when they are ready.</p></div>}</section>}
  </>;
}
