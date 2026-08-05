import { Building2, CheckCircle2, FileText, Mail, MapPin, Phone, Save, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";

export default function PartnerPortal({ view = "documents" }) {
  const { user } = useAuth();
  const [partner, setPartner] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ full_name: user.full_name, email: user.email, phone: "" });
  const load = useCallback(() => {
    setError("");
    api(`/partners/${user.partner_id}`).then((data) => {
      setPartner(data);
      setProfile({ full_name: data.contact_name || user.full_name, email: data.contact_email || user.email, phone: data.contact_phone || "" });
    }).catch((requestError) => setError(requestError.message));
  }, [user]);
  useEffect(() => { load(); }, [load]);
  async function saveProfile() {
    setSaving(true); setError("");
    try {
      const updated = await api(`/partners/${partner.id}`, {
        method: "PATCH",
        body: JSON.stringify({ contact_name: profile.full_name, contact_email: profile.email, contact_phone: profile.phone })
      });
      setPartner((current) => ({ ...current, ...updated }));
      setMessage("Profile contact information updated and audit event recorded.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }
  if (error && !partner) return <><PageHeader eyebrow="Partner portal" title="Unable to load partner workspace" /><ErrorState message={error} onRetry={load} /></>;
  if (!partner) return <LoadingState label="Loading partner workspace" />;

  if (view === "profile") return <>
    <Toast message={message} onClose={() => setMessage("")} /><Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Partner portal" title="Institution profile and contact" description="Update the official contact information retained for verification and audit." />
    <div className="detail-grid"><section className="panel detail-main-card"><div className="partner-profile-head"><span className="large-partner-icon"><Building2 /></span><div><h2>{partner.name}</h2><p>{partner.institution_type} · {partner.country}</p></div></div><div className="form-grid"><label className="form-field"><span>Primary contact name</span><input value={profile.full_name} onChange={(event) => setProfile({ ...profile, full_name: event.target.value })} /></label><label className="form-field"><span>Official email</span><input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label><label className="form-field"><span>Phone number</span><input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label></div><button className="primary-button" disabled={saving} onClick={saveProfile}><Save size={17} /> {saving ? "Saving…" : "Save profile"}</button></section><aside className="panel detail-side-card"><h2>Institution details</h2><div className="contact-grid single-contact"><article><MapPin /><div><span>Country / region</span><strong>{partner.country}, {partner.region}</strong></div></article><article><ShieldCheck /><div><span>Verification</span><StatusBadge status={partner.verification_status} /></div></article><article><Mail /><div><span>Official email</span><strong>{partner.contact_email}</strong></div></article><article><Phone /><div><span>Phone</span><strong>{partner.contact_phone}</strong></div></article></div></aside></div>
  </>;

  if (view === "registration") return <>
    <PageHeader eyebrow="Partner portal" title="Registration status" description="Track institution verification and any additional information requested by the Directorate." />
    <section className="panel registration-status-card"><div className="registration-status-head"><div><span className="section-kicker">Institution profile</span><h2>{partner.name}</h2><p>Registration number {partner.registration_number}</p></div><StatusBadge status={partner.verification_status} /></div><div className="status-process"><article className="complete"><CheckCircle2 /><div><strong>Registration submitted</strong><span>Institution and primary contact information received.</span></div></article><article className={partner.documents?.length ? "complete" : "active"}><CheckCircle2 /><div><strong>Supporting evidence</strong><span>{partner.documents?.length || 0} document(s) available.</span></div></article><article className={partner.verification_status === "verified" ? "complete" : "active"}><CheckCircle2 /><div><strong>Directorate verification</strong><span>{partner.verification_status.replaceAll("_", " ")}</span></div></article><article className={partner.champion_id ? "complete" : "pending"}><CheckCircle2 /><div><strong>Champion assignment</strong><span>{partner.champion_name || "Not yet assigned"}</span></div></article></div></section>
  </>;

  const visibleDocuments = useMemo(() => (partner.documents || []).filter((document) => !["restricted", "confidential"].includes(document.confidentiality)), [partner]);
  return <>
    <PageHeader eyebrow="Partner portal" title="Shared documents" description="Only documents explicitly shared with your institution appear in this workspace." />
    <section className="panel data-panel"><div className="document-list">{visibleDocuments.map((document) => <article className="document-row" key={document.id}><span className="document-icon"><FileText /></span><div><strong>{document.name}</strong><span>{document.type} · Version {document.version}</span><small>Uploaded by {document.uploaded_by} on {formatDate(document.uploaded_at)}</small></div><StatusBadge status={document.status} /></article>)}</div>{!visibleDocuments.length && <div className="inline-empty"><CheckCircle2 /> No partner-visible documents have been shared.</div>}</section>
  </>;
}
