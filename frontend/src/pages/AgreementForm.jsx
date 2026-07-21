import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import Toast from "../components/Toast";
import { api } from "../lib/api";

const initial = {
  title: "",
  agreement_type: "MoU",
  partner_id: "",
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
  const [form, setForm] = useState(initial);
  const [partners, setPartners] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => { api("/partners").then(setPartners); }, []);
  function change(event) { setForm({ ...form, [event.target.name]: event.target.value }); }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, partner_id: Number(form.partner_id) };
      for (const key of ["effective_date", "expiry_date", "internal_champion", "partner_liaison", "expected_outcomes", "strategic_alignment"]) {
        if (!payload[key]) payload[key] = null;
      }
      const result = await api("/agreements", { method: "POST", body: JSON.stringify(payload) });
      navigate(`/agreements/${result.id}`);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <>
      <PageHeader eyebrow="Researcher self-service" title="New agreement request" description="Create a governed MoU, CRA or CA request and route it through the institutional workflow." actions={<Link className="secondary-button" to="/agreements"><ArrowLeft size={17} /> Back</Link>} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <form className="form-layout" onSubmit={submit}>
        <section className="panel form-section span-2">
          <div className="section-heading"><span>01</span><div><h3>Agreement information</h3><p>Basic identification, purpose and institutional classification.</p></div></div>
          <div className="form-grid">
            <label className="full-span">Agreement title<input name="title" value={form.title} onChange={change} required placeholder="e.g. Joint Research and Innovation Collaboration" /></label>
            <label>Agreement type<select name="agreement_type" value={form.agreement_type} onChange={change}><option>MoU</option><option>CRA</option><option>CA</option><option>Other</option></select></label>
            <label>Partner<select name="partner_id" value={form.partner_id} onChange={change} required><option value="">Select partner</option>{partners.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label>Proposing department / faculty<input name="department" value={form.department} onChange={change} required placeholder="School or department" /></label>
            <label>Strategic alignment<input name="strategic_alignment" value={form.strategic_alignment} onChange={change} placeholder="Research, innovation, training..." /></label>
            <label className="full-span">Purpose<textarea name="purpose" value={form.purpose} onChange={change} required rows="5" placeholder="Describe why the agreement is required and the collaboration it enables." /></label>
            <label className="full-span">Expected outcomes<textarea name="expected_outcomes" value={form.expected_outcomes} onChange={change} rows="4" placeholder="Internships, publications, consultancies, grants, projects or other outputs." /></label>
          </div>
        </section>
        <section className="panel form-section">
          <div className="section-heading"><span>02</span><div><h3>Activation readiness</h3><p>Optional now; required before activation.</p></div></div>
          <div className="form-grid single-column">
            <label>Internal champion<input name="internal_champion" value={form.internal_champion} onChange={change} /></label>
            <label>Partner liaison<input name="partner_liaison" value={form.partner_liaison} onChange={change} /></label>
            <label>Effective date<input type="date" name="effective_date" value={form.effective_date} onChange={change} /></label>
            <label>Expiry date<input type="date" name="expiry_date" value={form.expiry_date} onChange={change} /></label>
            <label>Confidentiality<select name="confidentiality" value={form.confidentiality} onChange={change}><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="public">Public</option></select></label>
          </div>
        </section>
        <div className="form-footer span-3"><span>A unique system reference will be generated after saving.</span><button className="primary-button" disabled={saving}><Save size={18} /> {saving ? "Creating..." : "Create request"}</button></div>
      </form>
    </>
  );
}
