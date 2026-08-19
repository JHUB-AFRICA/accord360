export default function FormField({ label, required, error, hint, children, className = "" }) {
  return (
    <label className={`form-field ${className}`}>
      <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
