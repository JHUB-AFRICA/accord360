import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { createAgreement, createPartner, listFieldDefinitions, listPartners, listTemplates } from "../lib/backend.js";

function isoDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// Minimal intake: just enough to create the Google Doc copy and invite the
// partner. Everything else the backend requires gets a placeholder that the
// parties can correct in the Doc itself.
export default function AgreementForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fields, setFields] = useState(null);
  const [partners, setPartners] = useState(null);
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [templates, setTemplates] = useState([]);
  const [documentType, setDocumentType] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listFieldDefinitions(), listPartners(), listTemplates()])
      .then(([definitions, partnerList, templateList]) => {
        if (!active) return;
        setFields(definitions);
        setPartners(partnerList);
        const usable = templateList.filter((item) => item.is_active && item.master_doc_id);
        setTemplates(usable);
        if (usable.length === 1) setDocumentType(usable[0].document_type);
      })
      .catch((requestError) => setError(requestError.message));
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const name = partnerName.trim();
    const email = partnerEmail.trim();
    if (!name || !email || !documentType) return setError("Partner name, partner email and a template are all required.");
    const title = `${documentType} — ${name}`;
    setSubmitting(true);
    try {
      let partner = partners.find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (partner && (partner.contact_email || "").toLowerCase() !== email.toLowerCase()) {
        throw new Error(`"${partner.name}" already exists with a different contact email (${partner.contact_email || "none"}). Use that email, or a different partner name.`);
      }
      if (!partner) {
        partner = await createPartner({ name, sector: "General", contact_email: email });
      }
      const start = isoDate(0);
      const end = isoDate(365);
      const values = Object.fromEntries(fields.filter((field) => field.required).map((field) => [field.field_name, "TBD"]));
      const created = await createAgreement({
        title,
        document_type: documentType,
        department: "General",
        partner_id: Number(partner.id),
        start_date: start,
        end_date: end,
        field_values: { ...values, partner_name: partner.name, agreement_title: title, department: "General", start_date: start, end_date: end, researcher_name: user.full_name }
      });
      setMessage("Drafting document created and shared with the partner.");
      navigate(`/agreements/${created.id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!fields || !partners) return <LoadingState label="Loading" />;

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader
        eyebrow="Researcher intake"
        title="Start a collaboration"
        description="Accord 360 copies the active Google Doc template and shares it with you and the partner to draft together. Nothing is sent to Linkages until you explicitly submit it from the agreement page."
        actions={<Link className="secondary-button" to="/agreements"><ArrowLeft size={17} /> Cancel</Link>}
      />
      <form className="panel wizard-shell" onSubmit={submit}>
        <div className="form-grid">
          <FormField label="Partner name" required>
            <input value={partnerName} onChange={(event) => setPartnerName(event.target.value)} list="known-partners" />
            <datalist id="known-partners">{partners.map((partner) => <option value={partner.name} key={partner.id} />)}</datalist>
          </FormField>
          <FormField label="Partner email (will be invited to the Google Doc)" required>
            <input type="email" value={partnerEmail} onChange={(event) => setPartnerEmail(event.target.value)} />
            <small className="helper-note">The partner gets a Google Docs invitation from "Accord 360". Ask them to check their spam folder, and not to block or report it — Google will then stop us sharing with them.</small>
          </FormField>
          <FormField label="Document template" required>
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
              <option value="">Select a template…</option>
              {templates.map((template) => <option value={template.document_type} key={template.id}>{template.document_type}</option>)}
            </select>
          </FormField>
        </div>
        <div className="wizard-footer">
          <span className="helper-note">You'll get a Google Doc link to review and hand off once the partner is done editing.</span>
          <button className="primary-button" disabled={submitting} type="submit">
            <Save size={16} /> {submitting ? "Creating…" : "Create drafting document"}
          </button>
        </div>
      </form>
    </>
  );
}
