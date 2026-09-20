import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { createAgreement, listFieldDefinitions, listPartners } from "../lib/backend.js";

export default function AgreementForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fields, setFields] = useState(null);
  const [partners, setPartners] = useState(null);
  const [values, setValues] = useState({});
  const [partnerId, setPartnerId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listFieldDefinitions(), listPartners()])
      .then(([definitions, partnerList]) => {
        if (!active) return;
        setFields(definitions);
        setPartners(partnerList);
        setValues(Object.fromEntries(definitions.map((field) => [field.field_name, field.field_name === "researcher_name" ? user.full_name : ""])));
      })
      .catch((requestError) => setError(requestError.message));
    return () => { active = false; };
  }, [user.full_name]);

  function update(fieldName, value) {
    setValues((current) => ({ ...current, [fieldName]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const selectedPartner = partners?.find((partner) => Number(partner.id) === Number(partnerId));
    const missing = (fields || [])
      .filter((field) => field.required && field.field_name !== "partner_name" && !String(values[field.field_name] || "").trim())
      .map((field) => field.label);
    if (!selectedPartner) return setError("Select a partner institution.");
    if (missing.length) return setError(`Complete required fields: ${missing.join(", ")}`);
    setSubmitting(true);
    try {
      const created = await createAgreement({
        title: values.agreement_title,
        department: values.department,
        partner_id: Number(partnerId),
        start_date: values.start_date,
        end_date: values.end_date,
        field_values: { ...values, partner_name: selectedPartner.name }
      });
      setMessage("Your intake was submitted to Linkages.");
      navigate(`/agreements/${created.id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!fields || !partners) return <LoadingState label="Loading Researcher form fields" />;

  return (
    <>
      <Toast message={message} onClose={() => setMessage("")} />
      <Toast message={error} type="error" onClose={() => setError("")} />
      <PageHeader
        eyebrow="Researcher intake"
        title="Submit collaboration information"
        description="Your structured information goes to Linkages. Linkages prepares and uploads the agreement draft for Legal review."
        actions={<Link className="secondary-button" to="/agreements"><ArrowLeft size={17} /> Cancel</Link>}
      />
      <form className="panel wizard-shell" onSubmit={submit}>
        <div className="section-heading">
          <h2>Agreement information</h2>
          <p>Fields are supplied by the active Linkages configuration. No document upload is required here.</p>
        </div>
        <div className="form-grid">
          <FormField label="Partner institution" required>
            <select value={partnerId} onChange={(event) => {
              const partner = partners.find((item) => Number(item.id) === Number(event.target.value));
              setPartnerId(event.target.value);
              if (partner) update("partner_name", partner.name);
            }}>
              <option value="">Select a partner…</option>
              {partners.map((partner) => <option value={partner.id} key={partner.id}>{partner.name}</option>)}
            </select>
          </FormField>
          {fields.map((field) => (
            <FormField label={field.label} required={field.required} key={field.field_name}>
              <input
                type={field.field_name.endsWith("_date") ? "date" : "text"}
                value={values[field.field_name] || ""}
                onChange={(event) => update(field.field_name, event.target.value)}
                readOnly={field.field_name === "partner_name" || field.field_name === "researcher_name"}
              />
            </FormField>
          ))}
        </div>
        <div className="wizard-footer">
          <span className="helper-note">The generated intake document is reviewed by Linkages before Legal receives a draft.</span>
          <button className="primary-button" disabled={submitting} type="submit">
            <Save size={16} /> {submitting ? "Submitting…" : "Submit to Linkages"}
          </button>
        </div>
      </form>
    </>
  );
}
