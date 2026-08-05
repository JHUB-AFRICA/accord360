import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Save, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ErrorState from "../components/ErrorState";
import FormField from "../components/FormField";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const DRAFT_KEY = "accord360_new_agreement_draft";
const steps = ["Partner", "Agreement details", "JKUAT ownership", "Template & draft", "Documents", "Review & submit"];

const initialForm = {
  partner_id: "",
  title: "",
  agreement_type: "MoU",
  purpose: "",
  collaboration_area: "",
  strategic_alignment: "",
  intended_start_date: "",
  proposed_duration_months: 36,
  expected_outcomes: "",
  risk: "low",
  special_considerations: "",
  faculty: "",
  department: "",
  champion_id: "",
  champion_assignment_date: "",
  champion_review_date: "",
  assign_champion_later: false,
  template_id: "",
  documents: []
};



function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...initialForm, ...JSON.parse(raw) } : initialForm;
  } catch {
    return initialForm;
  }
}

export default function AgreementForm() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(readDraft);
  const [partners, setPartners] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [referenceData, setReferenceData] = useState(null);
  const [users, setUsers] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api("/partners"), api("/templates"), api("/directory/champions"), api("/reference-data")])
      .then(([partnerData, templateData, userData, references]) => { setPartners(partnerData); setTemplates(templateData); setUsers(userData); setReferenceData(references); })
      .catch((error) => setServerError(error.message));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setLastSaved(new Date());
    }, 500);
    return () => clearTimeout(timeout);
  }, [form]);

  const availableTemplates = useMemo(() => (templates || []).filter((template) => template.agreement_type === form.agreement_type && template.status === "active"), [templates, form.agreement_type]);
  const requiredDocuments = referenceData?.required_document_rules?.find((rule) => rule.agreement_type === form.agreement_type)?.documents || [];
  const canAssignLater = ["linkages", "director_linkages"].includes(user.role);
  const missingDocuments = requiredDocuments.filter((requirement) => !form.documents.some((document) => document.requirement === requirement));

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "", form: "" }));
  }

  function validateStep(targetStep = step) {
    const nextErrors = {};
    if (targetStep === 1 && !form.partner_id) nextErrors.partner_id = "Select an existing partner institution.";
    if (targetStep === 2) {
      if (!form.title.trim()) nextErrors.title = "Enter a request title.";
      if (!form.agreement_type) nextErrors.agreement_type = "Select an agreement type.";
      if (!form.purpose.trim()) nextErrors.purpose = "Describe the purpose.";
      if (!form.collaboration_area.trim()) nextErrors.collaboration_area = "Describe the collaboration area.";
      if (!form.strategic_alignment.trim()) nextErrors.strategic_alignment = "Explain the strategic alignment.";
      if (!form.intended_start_date) nextErrors.intended_start_date = "Select the intended start date.";
      if (!form.expected_outcomes.trim()) nextErrors.expected_outcomes = "Provide measurable expected outcomes.";
    }
    if (targetStep === 3) {
      if (!form.faculty) nextErrors.faculty = "Select the host faculty.";
      if (!form.department) nextErrors.department = "Select the host department.";
      if ((!canAssignLater || !form.assign_champion_later) && !form.champion_id) nextErrors.champion_id = "Assign an internal Champion.";
      if (form.champion_id && !form.champion_assignment_date) nextErrors.champion_assignment_date = "Select the assignment date.";
    }
    if (targetStep === 4 && !form.template_id) nextErrors.template_id = "Select an approved template.";
    if (targetStep === 5 && missingDocuments.length) nextErrors.documents = `Upload all required documents: ${missingDocuments.join(", ")}.`;
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function next() {
    if (validateStep()) setStep((value) => Math.min(6, value + 1));
    else setErrors((current) => ({ ...current, form: "Review the highlighted fields before continuing." }));
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    setLastSaved(new Date());
    setMessage("Draft saved in this browser.");
  }

  function addDocument(requirement, file) {
    if (!file) return;
    const document = {
      id: `local-${Date.now()}`,
      requirement,
      name: file.name,
      type: requirement,
      version: "1.0",
      status: "uploaded",
      confidentiality: "internal",
      uploaded_by: "Current user",
      uploaded_at: new Date().toISOString(),
      size: file.size
    };
    update("documents", [...form.documents.filter((item) => item.requirement !== requirement), document]);
  }

  async function submit(asDraft = false) {
    if (!asDraft) {
      for (let currentStep = 1; currentStep <= 5; currentStep += 1) {
        if (!validateStep(currentStep)) {
          setStep(currentStep);
          setErrors((current) => ({ ...current, form: "Complete all required information before submitting." }));
          return;
        }
      }
    }
    setSubmitting(true);
    setServerError("");
    try {
      const payload = {
        ...form,
        submit: !asDraft,
        expected_outcomes: form.expected_outcomes.split("\n").map((value) => value.trim()).filter(Boolean)
      };
      const created = await api("/agreements", { method: "POST", body: JSON.stringify(payload) });
      localStorage.removeItem(DRAFT_KEY);
      setMessage(asDraft ? "Draft created successfully." : "Request submitted successfully.");
      setTimeout(() => navigate(`/agreements/${created.id}`, { replace: true }), 500);
    } catch (error) {
      setServerError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (serverError && !partners) return <><PageHeader eyebrow="Create request" title="New partnership request" /><ErrorState message={serverError} /></>;
  if (!partners || !templates || !referenceData) return <LoadingState label="Preparing the partnership request wizard" />;

  const selectedPartner = partners.find((partner) => partner.id === form.partner_id);
  const selectedTemplate = templates.find((template) => template.id === form.template_id);
  const selectedChampion = users.find((user) => user.id === form.champion_id);

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} /><Toast message={serverError} type="error" onClose={() => setServerError("")} />
      <PageHeader eyebrow="Guided request wizard" title="New partnership request" description="Complete each step. Accord360 saves the draft automatically in this browser until it is submitted." actions={<Link className="secondary-button" to="/agreements"><ArrowLeft size={17} /> Cancel</Link>} meta={lastSaved && <span>Draft autosaved at {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>} />

      <div className="wizard-stepper">{steps.map((label, index) => <button type="button" key={label} className={`${step === index + 1 ? "active" : ""} ${step > index + 1 ? "done" : ""}`} onClick={() => { if (index + 1 < step || validateStep()) setStep(index + 1); }}><span>{step > index + 1 ? <CheckCircle2 size={16} /> : index + 1}</span><b>{label}</b></button>)}</div>
      {errors.form && <div className="form-alert error">{errors.form}</div>}

      <div className="wizard-layout">
        <section className="panel wizard-main">
          {step === 1 && <div className="wizard-section"><div className="wizard-heading"><span>01</span><div><h2>Select the partner institution</h2><p>Every request must link to a verified or actively reviewed partner profile.</p></div></div><div className="form-grid single-column"><FormField label="Search and select partner" required error={errors.partner_id}><select value={form.partner_id} onChange={(event) => update("partner_id", event.target.value)}><option value="">Select a partner…</option>{partners.map((partner) => <option value={partner.id} key={partner.id}>{partner.name} · {partner.country} · {partner.verification_status.replaceAll("_", " ")}</option>)}</select></FormField></div>{selectedPartner && <article className="selection-card"><div><strong>{selectedPartner.name}</strong><span>{selectedPartner.institution_type} · {selectedPartner.country}</span></div><StatusBadge status={selectedPartner.verification_status} /></article>}<div className="wizard-notice"><strong>Partner not registered?</strong><span>Linkages users may create a partner profile. External institutions should use the public partner registration form.</span><Link to="/partner/register">Open registration</Link></div></div>}

          {step === 2 && <div className="wizard-section"><div className="wizard-heading"><span>02</span><div><h2>Agreement details</h2><p>Describe the collaboration, expected outcomes and intended implementation period.</p></div></div><div className="form-grid"><FormField label="Request title" required error={errors.title} className="full-span"><input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Digital Agriculture Research Collaboration" /></FormField><FormField label="Agreement type" required error={errors.agreement_type}><select value={form.agreement_type} onChange={(event) => { update("agreement_type", event.target.value); update("template_id", ""); update("documents", []); }}>{referenceData.agreement_types.map((type) => <option value={type.abbreviation} key={type.id}>{type.abbreviation} — {type.name}</option>)}</select></FormField><FormField label="Intended project start date" required error={errors.intended_start_date}><input type="date" value={form.intended_start_date} onChange={(event) => update("intended_start_date", event.target.value)} /></FormField><FormField label="Proposed duration (months)" required><input type="number" min="1" max="120" value={form.proposed_duration_months} onChange={(event) => update("proposed_duration_months", Number(event.target.value))} /></FormField><FormField label="Initial risk assessment"><select value={form.risk} onChange={(event) => update("risk", event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></FormField><FormField label="Purpose" required error={errors.purpose} className="full-span"><textarea rows="4" value={form.purpose} onChange={(event) => update("purpose", event.target.value)} /></FormField><FormField label="Collaboration area" required error={errors.collaboration_area} className="full-span"><textarea rows="3" value={form.collaboration_area} onChange={(event) => update("collaboration_area", event.target.value)} /></FormField><FormField label="Strategic alignment" required error={errors.strategic_alignment} className="full-span"><textarea rows="3" value={form.strategic_alignment} onChange={(event) => update("strategic_alignment", event.target.value)} /></FormField><FormField label="Expected outcomes" required error={errors.expected_outcomes} hint="Enter one measurable outcome per line." className="full-span"><textarea rows="5" value={form.expected_outcomes} onChange={(event) => update("expected_outcomes", event.target.value)} /></FormField><FormField label="Risks or special considerations" className="full-span"><textarea rows="3" value={form.special_considerations} onChange={(event) => update("special_considerations", event.target.value)} /></FormField></div></div>}

          {step === 3 && <div className="wizard-section"><div className="wizard-heading"><span>03</span><div><h2>JKUAT ownership</h2><p>Assign the academic host and internal Champion responsible for the collaboration.</p></div></div><div className="form-grid"><FormField label="Host faculty" required error={errors.faculty}><select value={form.faculty} onChange={(event) => update("faculty", event.target.value)}><option value="">Select faculty…</option>{referenceData.faculties.map((faculty) => <option key={faculty}>{faculty}</option>)}</select></FormField><FormField label="Host department" required error={errors.department}><select value={form.department} onChange={(event) => update("department", event.target.value)}><option value="">Select department…</option>{referenceData.departments.map((department) => <option key={department}>{department}</option>)}</select></FormField><FormField label="Internal JKUAT Champion" required={!form.assign_champion_later} error={errors.champion_id} className="full-span"><select disabled={form.assign_champion_later} value={form.champion_id} onChange={(event) => update("champion_id", event.target.value)}><option value="">Select Champion…</option>{users.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.full_name} · {candidate.department}</option>)}</select></FormField><FormField label="Assignment date" required={Boolean(form.champion_id)} error={errors.champion_assignment_date}><input disabled={form.assign_champion_later} type="date" value={form.champion_assignment_date} onChange={(event) => update("champion_assignment_date", event.target.value)} /></FormField><FormField label="Assignment review date"><input disabled={form.assign_champion_later} type="date" value={form.champion_review_date} onChange={(event) => update("champion_review_date", event.target.value)} /></FormField>{canAssignLater && <label className="checkbox-card full-span"><input type="checkbox" checked={form.assign_champion_later} onChange={(event) => { update("assign_champion_later", event.target.checked); if (event.target.checked) update("champion_id", ""); }} /><span><strong>Assign Champion later</strong><small>Only Linkages may defer assignment. Drafting cannot proceed beyond the configured gate until a Champion is assigned.</small></span></label>}</div></div>}

          {step === 4 && <div className="wizard-section"><div className="wizard-heading"><span>04</span><div><h2>Select an approved template</h2><p>Templates are filtered by agreement type. The working draft will retain version history and compliance status.</p></div></div>{availableTemplates.length ? <div className="template-grid">{availableTemplates.map((template) => <button type="button" key={template.id} className={`template-card ${form.template_id === template.id ? "selected" : ""}`} onClick={() => update("template_id", template.id)}><div className="template-card-top"><FileText /><StatusBadge status={template.status} /></div><h3>{template.name}</h3><p>{template.description}</p><dl><div><dt>Version</dt><dd>{template.version}</dd></div><div><dt>Effective</dt><dd>{template.effective_date}</dd></div><div><dt>Owner</dt><dd>{template.owner}</dd></div></dl><span className="template-select-label">{form.template_id === template.id ? "Selected" : "Select template"}</span></button>)}</div> : <ErrorState title="No active template available" message={`An administrator and Legal Office must publish an approved ${form.agreement_type} template before submission.`} />}{errors.template_id && <small className="field-error block-error">{errors.template_id}</small>}{selectedTemplate && <div className="compliance-card"><div><strong>Template compliance</strong><span>The draft starts from the approved standard template.</span></div><div className="compliance-score">100%</div></div>}</div>}

          {step === 5 && <div className="wizard-section"><div className="wizard-heading"><span>05</span><div><h2>Required documents</h2><p>The checklist changes by agreement type. Submission is blocked until all mandatory items are uploaded.</p></div></div><div className="document-checklist">{requiredDocuments.map((requirement) => { const uploaded = form.documents.find((document) => document.requirement === requirement); return <article className={uploaded ? "complete" : ""} key={requirement}><div><span>{uploaded ? <CheckCircle2 size={18} /> : <UploadCloud size={18} />}</span><div><strong>{requirement}</strong><small>{uploaded ? `${uploaded.name} · uploaded` : "Required · missing"}</small></div></div><label className="upload-button">{uploaded ? "Replace" : "Upload"}<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => addDocument(requirement, event.target.files?.[0])} /></label></article>; })}</div>{errors.documents && <div className="form-alert error">{errors.documents}</div>}<div className="wizard-notice"><strong>Document service integration</strong><span>Selected files are validated, scanned, classified and retained with their version history when the request is saved.</span></div></div>}

          {step === 6 && <div className="wizard-section"><div className="wizard-heading"><span>06</span><div><h2>Review and submit</h2><p>Confirm the complete request before sending it to the next responsible office.</p></div></div><div className="review-grid"><article><h3>Partner</h3><dl><div><dt>Institution</dt><dd>{selectedPartner?.name || "—"}</dd></div><div><dt>Country</dt><dd>{selectedPartner?.country || "—"}</dd></div><div><dt>Verification</dt><dd><StatusBadge status={selectedPartner?.verification_status} /></dd></div></dl></article><article><h3>Agreement</h3><dl><div><dt>Title</dt><dd>{form.title}</dd></div><div><dt>Type</dt><dd>{form.agreement_type}</dd></div><div><dt>Start date</dt><dd>{form.intended_start_date}</dd></div><div><dt>Duration</dt><dd>{form.proposed_duration_months} months</dd></div></dl></article><article><h3>JKUAT ownership</h3><dl><div><dt>Faculty</dt><dd>{form.faculty}</dd></div><div><dt>Department</dt><dd>{form.department}</dd></div><div><dt>Champion</dt><dd>{selectedChampion?.full_name || (form.assign_champion_later ? "Assign later" : "—")}</dd></div></dl></article><article><h3>Template & documents</h3><dl><div><dt>Template</dt><dd>{selectedTemplate?.name || "—"}</dd></div><div><dt>Version</dt><dd>{selectedTemplate?.version || "—"}</dd></div><div><dt>Documents</dt><dd>{form.documents.length}/{requiredDocuments.length} uploaded</dd></div></dl></article></div><div className="submission-next"><strong>Next stage after submission</strong><span>Faculty review, where required by the configured workflow. The assigned office, due date and progress timeline will appear on the confirmation record.</span></div></div>}

          <div className="wizard-actions"><button type="button" className="secondary-button" onClick={() => step > 1 ? setStep((value) => value - 1) : navigate("/agreements")}><ArrowLeft size={17} /> {step > 1 ? "Back" : "Cancel"}</button><div><button type="button" className="text-button" onClick={saveDraft}><Save size={16} /> Save draft</button>{step < 6 ? <button type="button" className="primary-button" onClick={next}>Continue <ArrowRight size={17} /></button> : <><button type="button" className="secondary-button" disabled={submitting} onClick={() => submit(true)}>Create as draft</button><button type="button" className="primary-button" disabled={submitting || missingDocuments.length > 0} onClick={() => submit(false)}>{submitting ? "Submitting…" : "Submit request"} <ArrowRight size={17} /></button></>}</div></div>
        </section>

        <aside className="panel wizard-aside"><h3>Request readiness</h3><div className="readiness-list"><span className={form.partner_id ? "done" : ""}><CheckCircle2 /> Partner selected</span><span className={form.title && form.purpose ? "done" : ""}><CheckCircle2 /> Agreement details</span><span className={form.faculty && form.department && (form.champion_id || form.assign_champion_later) ? "done" : ""}><CheckCircle2 /> JKUAT ownership</span><span className={form.template_id ? "done" : ""}><CheckCircle2 /> Approved template</span><span className={!missingDocuments.length ? "done" : ""}><CheckCircle2 /> Required documents</span></div><hr /><h3>Current request</h3><dl className="aside-summary"><div><dt>Partner</dt><dd>{selectedPartner?.name || "Not selected"}</dd></div><div><dt>Agreement type</dt><dd>{form.agreement_type}</dd></div><div><dt>Host</dt><dd>{form.department || "Not selected"}</dd></div><div><dt>Template</dt><dd>{selectedTemplate ? `${selectedTemplate.name} v${selectedTemplate.version}` : "Not selected"}</dd></div></dl></aside>
      </div>
    </>
  );
}
