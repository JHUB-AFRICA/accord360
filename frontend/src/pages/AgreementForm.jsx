import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import Toast from "../components/Toast";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const initial = {
  title: "",
  agreement_type: "MoU",
  partner_id: "",
  champion_user_id: "",
  department: "",
  strategic_alignment: "",
  purpose: "",
  expected_outcomes: "",
  confidentiality: "internal",
  internal_champion: "",
  partner_liaison: "",
  effective_date: "",
  expiry_date: ""
};

export default function AgreementForm() {
  const { user } = useAuth();
  const isLinkages = ["linkages", "director_linkages"].includes(user.role);
  const [form, setForm] = useState(() => ({ ...initial, internal_champion: user.role === "researcher" ? user.full_name : "" }));
  const [partners, setPartners] = useState([]);
  const [champions, setChampions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api("/partners").then(setPartners);
    if (isLinkages) api("/users/champions").then(setChampions).catch((err) => setError(err.message));
  }, [isLinkages]);
  function change(event) { setForm({ ...form, [event.target.name]: event.target.value }); }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        partner_id: Number(form.partner_id),
        champion_user_id: isLinkages ? Number(form.champion_user_id) : null
      };
      for (const key of ["effective_date", "expiry_date", "internal_champion", "partner_liaison", "expected_outcomes", "strategic_alignment"]) {
        if (!payload[key]) payload[key] = null;
      }
      const result = await api("/agreements", { method: "POST", body: JSON.stringify(payload) });
      for (const file of attachments) {
        const data = new FormData();
        data.append("file", file);
        data.append("document_type", "supporting");
        data.append("version", "1.0");
        data.append("confidentiality", form.confidentiality);
        data.append("is_official", "false");
        await api(`/agreements/${result.id}/documents`, { method: "POST", body: data });
      }
      navigate(`/agreements/${result.id}`);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <>
      <PageHeader eyebrow={isLinkages ? "Partner request logging" : "Champion self-service"} title={isLinkages ? "Log and assign collaboration request" : "New agreement request"} description={isLinkages ? "Capture a partner-originated request and assign an internal JKUAT Champion before drafting begins." : "Create a governed MoU, CRA or CA request and route it through the institutional workflow."} actions={<Link className="secondary-button" to="/agreements"><ArrowLeft size={17} /> Back</Link>} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <form className="form-layout" onSubmit={submit}>
        <section className="panel form-section span-2">
          <div className="section-heading"><span>01</span><div><h3>Agreement information</h3><p>Basic identification, purpose and institutional classification.</p></div></div>
          <div className="form-grid">
            <label className="full-span">Agreement title<input name="title" value={form.title} onChange={change} required placeholder="e.g. Joint Research and Innovation Collaboration" /></label>
            <label>Agreement type<select name="agreement_type" value={form.agreement_type} onChange={change}><option>MoU</option><option>CRA</option><option>CA</option><option>Other</option></select></label>
            <label>Partner<select name="partner_id" value={form.partner_id} onChange={change} required><option value="">Select partner</option>{partners.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            {isLinkages && <label>Assigned JKUAT Champion<select name="champion_user_id" value={form.champion_user_id} onChange={(event) => {
              const selected = champions.find((item) => item.id === Number(event.target.value));
              setForm({ ...form, champion_user_id: event.target.value, internal_champion: selected?.full_name || "", department: selected?.department || form.department });
            }} required><option value="">Select Champion</option>{champions.map((item) => <option value={item.id} key={item.id}>{item.full_name} · {item.department || "JKUAT"}</option>)}</select></label>}
            <label>Proposing department / faculty<input name="department" value={form.department} onChange={change} required placeholder="School or department" /></label>
            <label>Strategic alignment<input name="strategic_alignment" value={form.strategic_alignment} onChange={change} placeholder="Research, innovation, training..." /></label>
            <label className="full-span">Purpose<textarea name="purpose" value={form.purpose} onChange={change} required rows="5" placeholder="Describe why the agreement is required and the collaboration it enables." /></label>
            <label className="full-span">Expected outcomes<textarea name="expected_outcomes" value={form.expected_outcomes} onChange={change} rows="4" placeholder="Internships, publications, consultancies, grants, projects or other outputs." /></label>
          </div>
        </section>
        <section className="panel form-section">
          <div className="section-heading"><span>02</span><div><h3>Activation readiness</h3><p>Optional now; required before activation.</p></div></div>
          <div className="form-grid single-column">
            <label>Internal Champion<input name="internal_champion" value={form.internal_champion} onChange={change} readOnly={user.role === "researcher" || isLinkages} /></label>
            <label>Partner liaison<input name="partner_liaison" value={form.partner_liaison} onChange={change} /></label>
            <label>Effective date<input type="date" name="effective_date" value={form.effective_date} onChange={change} /></label>
            <label>Expiry date<input type="date" name="expiry_date" value={form.expiry_date} onChange={change} /></label>
            <label>Confidentiality<select name="confidentiality" value={form.confidentiality} onChange={change}><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="public">Public</option></select></label>
            <label>Supporting documents<input type="file" multiple onChange={(event) => setAttachments(Array.from(event.target.files || []))} /><small>{attachments.length ? `${attachments.length} file(s) selected` : "Concept notes, drafts, partner profiles or correspondence"}</small></label>
          </div>
        </section>
        <div className="form-footer span-3"><span>A unique system reference will be generated after saving.</span><button className="primary-button" disabled={saving}><Save size={18} /> {saving ? "Creating..." : "Create request"}</button></div>
      </form>
    </>
  );
}
