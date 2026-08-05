import { ArrowLeft, ArrowRight, Building2, CheckCircle2, FileUp, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FormField from "../components/FormField";

const initial = {
  institution_name: "", institution_type: "University", country: "", region: "", website: "",
  registration_number: "", contact_name: "", job_title: "", official_email: "", phone: "",
  collaboration_area: "", strategic_alignment: "", documents: [], consent: false
};

export default function PartnerRegister() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submissionNotice, setSubmissionNotice] = useState("");
  const steps = ["Institution", "Primary contact", "Collaboration", "Documents & review"];

  const canContinue = useMemo(() => {
    if (step === 1) return form.institution_name && form.institution_type && form.country && form.website;
    if (step === 2) return form.contact_name && form.job_title && form.official_email && form.phone;
    if (step === 3) return form.collaboration_area && form.strategic_alignment;
    return form.consent;
  }, [form, step]);

  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: "" })); }
  function next() { if (canContinue) setStep((value) => Math.min(4, value + 1)); else setErrors({ form: "Complete all required fields before continuing." }); }

  function submit(event) {
    event.preventDefault();
    if (!form.consent) { setErrors({ consent: "Confirm the declaration before continuing." }); return; }
    setSubmissionNotice("The current backend does not expose public partner registration. Your information remains only in this browser form and has not been sent. The backend developer must implement an approved registration endpoint before online submission is enabled.");
  }

  return (
    <div className="registration-page">
      <div className="registration-top"><Link to="/"><ArrowLeft size={17} /> Back to public portal</Link><div><span>Accord360</span><strong>Partner institution registration</strong></div></div>
      <div className="registration-layout">
        <aside className="registration-aside"><span className="section-kicker">What happens next?</span><h1>Start a credible partnership with JKUAT.</h1><p>Provide genuine institutional, contact and collaboration information for Directorate review.</p><div className="registration-next"><article><span>1</span><div><strong>Linkages verification</strong><p>The Directorate reviews registration, accreditation and official contact evidence.</p></div></article><article><span>2</span><div><strong>Champion assignment</strong><p>An internal JKUAT Champion is assigned before partner-originated drafting proceeds.</p></div></article><article><span>3</span><div><strong>Agreement preparation</strong><p>The responsible users select the correct template and required documents.</p></div></article></div></aside>
        <main className="registration-card">
          <div className="registration-stepper">{steps.map((label, index) => <div className={`${step > index + 1 ? "done" : step === index + 1 ? "active" : ""}`} key={label}><span>{step > index + 1 ? <CheckCircle2 size={16} /> : index + 1}</span><b>{label}</b></div>)}</div>
          {errors.form && <div className="form-alert error">{errors.form}</div>}{submissionNotice && <div className="form-alert warning">{submissionNotice}</div>}
          <form onSubmit={submit}>
            {step === 1 && <section className="form-section-clean"><div className="section-heading-inline"><Building2 /><div><h2>Institution information</h2><p>Use the institution's official registered details.</p></div></div><div className="form-grid"><FormField label="Institution name" required><input value={form.institution_name} onChange={(e) => update("institution_name", e.target.value)} /></FormField><FormField label="Institution type" required><select value={form.institution_type} onChange={(e) => update("institution_type", e.target.value)}><option>Government</option><option>University</option><option>NGO</option><option>Private Sector</option><option>Development Partner</option><option>Other</option></select></FormField><FormField label="Country of origin" required><input value={form.country} onChange={(e) => update("country", e.target.value)} /></FormField><FormField label="County or region"><input value={form.region} onChange={(e) => update("region", e.target.value)} /></FormField><FormField label="Official website" required><input type="url" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://institution.example" /></FormField><FormField label="Registration or accreditation number"><input value={form.registration_number} onChange={(e) => update("registration_number", e.target.value)} /></FormField></div></section>}
            {step === 2 && <section className="form-section-clean"><div className="section-heading-inline"><UserRound /><div><h2>Primary contact person</h2><p>Use a contact who is formally associated with the institution.</p></div></div><div className="form-grid"><FormField label="Full name" required><input value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} /></FormField><FormField label="Job title" required><input value={form.job_title} onChange={(e) => update("job_title", e.target.value)} /></FormField><FormField label="Official email" required><input type="email" value={form.official_email} onChange={(e) => update("official_email", e.target.value)} /></FormField><FormField label="Phone number" required><input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></FormField></div></section>}
            {step === 3 && <section className="form-section-clean"><div className="section-heading-inline"><ArrowRight /><div><h2>Collaboration interest</h2><p>Describe the intended collaboration and its strategic value.</p></div></div><div className="form-grid single-column"><FormField label="Proposed collaboration area" required><textarea rows="5" value={form.collaboration_area} onChange={(e) => update("collaboration_area", e.target.value)} /></FormField><FormField label="Strategic alignment" required><textarea rows="4" value={form.strategic_alignment} onChange={(e) => update("strategic_alignment", e.target.value)} /></FormField></div></section>}
            {step === 4 && <section className="form-section-clean"><div className="section-heading-inline"><FileUp /><div><h2>Supporting documents and review</h2><p>Upload the institution's registration and accreditation evidence.</p></div></div><div className="upload-zone"><FileUp size={28} /><strong>Drag files here or browse</strong><span>Registration certificate, charter, accreditation or supporting evidence. PDF/DOCX, maximum 10 MB per file.</span><input type="file" multiple onChange={(e) => update("documents", Array.from(e.target.files || []).map((file) => ({ name: file.name, size: file.size, type: file.type })))} /></div>{form.documents.length > 0 && <div className="file-chip-list">{form.documents.map((file) => <span key={file.name}>{file.name}</span>)}</div>}<div className="review-summary"><h3>Application summary</h3><dl><div><dt>Institution</dt><dd>{form.institution_name}</dd></div><div><dt>Type</dt><dd>{form.institution_type}</dd></div><div><dt>Country</dt><dd>{form.country}</dd></div><div><dt>Contact</dt><dd>{form.contact_name}</dd></div></dl></div><label className="consent-box"><input type="checkbox" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} /><span>I confirm that the submitted information is authentic and that I am authorized to represent the institution.</span></label>{errors.consent && <small className="field-error">{errors.consent}</small>}</section>}
            <div className="registration-actions">{step > 1 ? <button type="button" className="secondary-button" onClick={() => setStep((value) => value - 1)}>Back</button> : <span />}{step < 4 ? <button type="button" className="primary-button" onClick={next} disabled={!canContinue}>Continue <ArrowRight size={17} /></button> : <button className="primary-button" disabled={!form.consent}>Check submission availability</button>}</div>
          </form>
        </main>
      </div>
    </div>
  );
}
