import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Plus, Save, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createAgreement,
  createPartner,
  listChampions,
  listPartners,
  transitionAgreement,
  uploadAgreementDocument
} from "../lib/backend.js";

const steps = ["Partner", "Agreement details", "JKUAT ownership", "Template & draft", "Documents", "Review & submit"];
const agreementTypes = ["MoU", "CRA", "CA", "Other"];
const localTemplates = {
  MoU: ["Standard institutional MoU", "Academic exchange MoU"],
  CRA: ["Collaborative Research Agreement", "Joint research and IP framework"],
  CA: ["CA template — official definition controlled by backend configuration"],
  Other: ["Approved custom agreement draft"]
};

const initialForm = {
  partner_id: "",
  title: "",
  agreement_type: "MoU",
  purpose: "",
  expected_outcomes: "",
  strategic_alignment: "",
  department: "",
  champion_user_id: "",
  confidentiality: "internal",
  internal_champion: "",
  partner_liaison: "",
  effective_date: "",
  expiry_date: "",
  template_name: "Standard institutional MoU",
  submitNow: true
};

export default function AgreementForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isLinkages = ["linkages", "director_linkages"].includes(user.role);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...initialForm, department: user.department || "", internal_champion: user.role === "researcher" ? user.full_name : "" });
  const [partners, setPartners] = useState(null);
  const [champions, setChampions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ name: "", sector: "", partner_type: "Institution", country: "Kenya", contact_name: "", contact_email: "", legal_counterpart: "", liaison: "", status: "active" });

  useEffect(() => {
    let active = true;
    Promise.all([listPartners(), isLinkages ? listChampions() : Promise.resolve([])])
      .then(([partnerList, championList]) => {
        if (!active) return;
        setPartners(partnerList);
        setChampions(championList);
      })
      .catch((requestError) => setError(requestError.message));
    return () => { active = false; };
  }, [isLinkages]);

  useEffect(() => {
    setForm((current) => ({ ...current, template_name: localTemplates[current.agreement_type]?.[0] || "Approved custom agreement draft" }));
  }, [form.agreement_type]);

  const selectedPartner = useMemo(() => partners?.find((item) => Number(item.id) === Number(form.partner_id)), [partners, form.partner_id]);
  const selectedChampion = useMemo(() => champions.find((item) => Number(item.id) === Number(form.champion_user_id)), [champions, form.champion_user_id]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function validateStep(index) {
    const nextErrors = {};
    if (index === 0 && !form.partner_id) nextErrors.partner_id = "Select a partner institution.";
    if (index === 1) {
      if (form.title.trim().length < 3) nextErrors.title = "Enter a title of at least three characters.";
      if (!agreementTypes.includes(form.agreement_type)) nextErrors.agreement_type = "Select a backend-supported agreement type.";
      if (form.purpose.trim().length < 10) nextErrors.purpose = "Purpose must contain at least 10 characters.";
    }
    if (index === 2) {
      if (form.department.trim().length < 2) nextErrors.department = "Department is required.";
      if (isLinkages && !form.champion_user_id) nextErrors.champion_user_id = "Linkages must assign an active researcher as Champion.";
    }
    if (index === 5 && form.effective_date && form.expiry_date && form.expiry_date <= form.effective_date) nextErrors.expiry_date = "Expiry date must be after the effective date.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function next() {
    if (validateStep(step)) setStep((value) => Math.min(steps.length - 1, value + 1));
  }

  async function addPartner() {
    if (partnerForm.name.trim().length < 2 || partnerForm.sector.trim().length < 2) {
      setError("Partner name and sector are required.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createPartner({ ...partnerForm, contact_email: partnerForm.contact_email || null });
      setPartners((current) => [...(current || []), created].sort((a, b) => a.name.localeCompare(b.name)));
      update("partner_id", String(created.id));
      setShowPartnerForm(false);
      setMessage("Partner created and selected.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (!validateStep(5)) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        agreement_type: form.agreement_type,
        purpose: form.purpose.trim(),
        expected_outcomes: form.expected_outcomes.trim() || null,
        strategic_alignment: form.strategic_alignment.trim() || null,
        department: form.department.trim(),
        partner_id: Number(form.partner_id),
        champion_user_id: isLinkages ? Number(form.champion_user_id) : null,
        confidentiality: form.confidentiality,
        internal_champion: isLinkages ? selectedChampion?.full_name || null : user.full_name,
        partner_liaison: form.partner_liaison.trim() || null,
        effective_date: form.effective_date || null,
        expiry_date: form.expiry_date || null
      };
      let created = await createAgreement(payload);
      for (const document of documents) {
        await uploadAgreementDocument(created.id, { file: document, documentType: "supporting", version: "1.0", confidentiality: form.confidentiality, isOfficial: false });
      }
      if (form.submitNow) created = await transitionAgreement(created.id, "submit", "Request submitted from the Accord360 request wizard.");
      navigate(`/agreements/${created.id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!partners) return <LoadingState label="Loading partners and Champion directory" />;

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader eyebrow="New collaboration request" title="Create an Accord360 agreement" description="This wizard submits only fields supported by the current FastAPI contract." actions={<Link className="secondary-button" to="/agreements"><ArrowLeft size={17} /> Cancel</Link>} />

      <section className="panel wizard-shell">
        <div className="wizard-stepper">{steps.map((label, index) => <button key={label} className={index === step ? "active" : index < step ? "complete" : ""} onClick={() => { if (index <= step) setStep(index); }}><span>{index < step ? <CheckCircle2 size={16} /> : index + 1}</span><strong>{label}</strong></button>)}</div>

        <div className="wizard-content">
          {step === 0 && <div className="form-section"><div className="section-heading"><h2>Select the partner</h2><p>The current backend exposes the authenticated partner registry through GET /partners.</p></div><FormField label="Partner institution" required error={errors.partner_id}><select value={form.partner_id} onChange={(event) => update("partner_id", event.target.value)}><option value="">Choose a partner…</option>{partners.map((partner) => <option value={partner.id} key={partner.id}>{partner.name} · {partner.country}</option>)}</select></FormField>{selectedPartner && <div className="selection-card"><CheckCircle2 /><div><strong>{selectedPartner.name}</strong><span>{selectedPartner.partner_type} · {selectedPartner.sector} · {selectedPartner.country}</span></div><StatusBadge status={selectedPartner.status} /></div>}<button className="secondary-button" onClick={() => setShowPartnerForm((value) => !value)}><Plus size={16} /> Add partner to registry</button>{showPartnerForm && <div className="panel inset-panel"><div className="form-grid"><FormField label="Institution name" required><input value={partnerForm.name} onChange={(event) => setPartnerForm({ ...partnerForm, name: event.target.value })} /></FormField><FormField label="Sector" required><input value={partnerForm.sector} onChange={(event) => setPartnerForm({ ...partnerForm, sector: event.target.value })} /></FormField><FormField label="Partner type"><input value={partnerForm.partner_type} onChange={(event) => setPartnerForm({ ...partnerForm, partner_type: event.target.value })} /></FormField><FormField label="Country"><input value={partnerForm.country} onChange={(event) => setPartnerForm({ ...partnerForm, country: event.target.value })} /></FormField><FormField label="Contact name"><input value={partnerForm.contact_name} onChange={(event) => setPartnerForm({ ...partnerForm, contact_name: event.target.value })} /></FormField><FormField label="Contact email"><input type="email" value={partnerForm.contact_email} onChange={(event) => setPartnerForm({ ...partnerForm, contact_email: event.target.value })} /></FormField></div><button className="primary-button" disabled={submitting} onClick={addPartner}>Create partner</button></div>}</div>}

          {step === 1 && <div className="form-section"><div className="section-heading"><h2>Agreement details</h2><p>Agreement types are restricted to the backend enum: MoU, CRA, CA and Other.</p></div><div className="form-grid"><FormField label="Request title" required error={errors.title} className="span-2"><input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Digital agriculture research collaboration" /></FormField><FormField label="Agreement type" required error={errors.agreement_type}><select value={form.agreement_type} onChange={(event) => update("agreement_type", event.target.value)}>{agreementTypes.map((type) => <option key={type}>{type}</option>)}</select></FormField><FormField label="Confidentiality"><select value={form.confidentiality} onChange={(event) => update("confidentiality", event.target.value)}><option value="public">Public</option><option value="internal">Internal</option><option value="confidential">Confidential</option></select></FormField><FormField label="Purpose" required error={errors.purpose} className="span-2"><textarea rows="5" value={form.purpose} onChange={(event) => update("purpose", event.target.value)} /></FormField><FormField label="Expected outcomes" className="span-2" hint="Separate outcomes with new lines."><textarea rows="4" value={form.expected_outcomes} onChange={(event) => update("expected_outcomes", event.target.value)} /></FormField><FormField label="Strategic alignment" className="span-2"><textarea rows="3" value={form.strategic_alignment} onChange={(event) => update("strategic_alignment", event.target.value)} /></FormField></div></div>}

          {step === 2 && <div className="form-section"><div className="section-heading"><h2>JKUAT ownership</h2><p>Researchers become the owner automatically. Linkages users must assign an active researcher returned by GET /users/champions.</p></div><div className="form-grid"><FormField label="Department" required error={errors.department}><input value={form.department} onChange={(event) => update("department", event.target.value)} /></FormField>{isLinkages ? <FormField label="Internal JKUAT Champion" required error={errors.champion_user_id}><select value={form.champion_user_id} onChange={(event) => update("champion_user_id", event.target.value)}><option value="">Select Champion…</option>{champions.map((champion) => <option value={champion.id} key={champion.id}>{champion.full_name} · {champion.department || "No department"}</option>)}</select></FormField> : <FormField label="Internal JKUAT Champion"><input value={user.full_name} disabled /></FormField>}<FormField label="Partner liaison"><input value={form.partner_liaison} onChange={(event) => update("partner_liaison", event.target.value)} /></FormField><FormField label="Effective date"><input type="date" value={form.effective_date} onChange={(event) => update("effective_date", event.target.value)} /></FormField><FormField label="Expiry date" error={errors.expiry_date}><input type="date" value={form.expiry_date} onChange={(event) => update("expiry_date", event.target.value)} /></FormField></div></div>}

          {step === 3 && <div className="form-section"><div className="section-heading"><h2>Template and draft guidance</h2><p>The current backend has no template endpoint. This selection guides the interface only and is not sent as an arbitrary API field.</p></div><div className="template-grid">{(localTemplates[form.agreement_type] || []).map((template) => <button key={template} className={`template-card ${form.template_name === template ? "selected" : ""}`} onClick={() => update("template_name", template)}><FileText /><div><strong>{template}</strong><span>Frontend drafting aid · backend template persistence pending</span></div>{form.template_name === template && <CheckCircle2 />}</button>)}</div></div>}

          {step === 4 && <div className="form-section"><div className="section-heading"><h2>Supporting documents</h2><p>Files are uploaded after agreement creation using multipart/form-data.</p></div><label className="upload-zone"><UploadCloud /><strong>Choose supporting documents</strong><span>PDF, DOC, DOCX, XLS, XLSX, CSV, PNG, JPG, JPEG or TXT · maximum 25 MB each</span><input type="file" multiple onChange={(event) => setDocuments(Array.from(event.target.files || []))} /></label><div className="document-list">{documents.map((file) => <article className="document-row" key={`${file.name}-${file.lastModified}`}><FileText /><div><strong>{file.name}</strong><span>{Math.ceil(file.size / 1024)} KB</span></div><StatusBadge status="uploaded" /></article>)}</div></div>}

          {step === 5 && <div className="form-section"><div className="section-heading"><h2>Review and submit</h2><p>Confirm the fields that will be sent to POST /agreements.</p></div><div className="review-grid"><article><span>Partner</span><strong>{selectedPartner?.name}</strong></article><article><span>Agreement type</span><strong>{form.agreement_type}</strong></article><article><span>Department</span><strong>{form.department}</strong></article><article><span>Champion</span><strong>{isLinkages ? selectedChampion?.full_name : user.full_name}</strong></article><article><span>Template guidance</span><strong>{form.template_name}</strong></article><article><span>Documents</span><strong>{documents.length}</strong></article></div><label className="consent-box"><input type="checkbox" checked={form.submitNow} onChange={(event) => update("submitNow", event.target.checked)} /><span>After creation, immediately call the supported workflow transition action <code>submit</code>.</span></label></div>}
        </div>

        <div className="wizard-footer"><button className="secondary-button" disabled={step === 0 || submitting} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={16} /> Back</button><div className="wizard-footer-actions">{step < steps.length - 1 ? <button className="primary-button" onClick={next}>Continue <ArrowRight size={16} /></button> : <button className="primary-button" disabled={submitting} onClick={submit}>{submitting ? "Creating…" : form.submitNow ? "Create & submit" : "Save draft"} <Save size={16} /></button>}</div></div>
      </section>
    </>
  );
}
