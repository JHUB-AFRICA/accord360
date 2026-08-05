import { CheckCircle2, X, XCircle } from "lucide-react";

export default function Toast({ message, type = "success", onClose }) {
  if (!message) return null;
  const Icon = type === "error" ? XCircle : CheckCircle2;
  return (
    <div className={`toast toast-${type}`} role={type === "error" ? "alert" : "status"}>
      <Icon size={18} />
      <span>{message}</span>
      <button onClick={onClose} aria-label="Dismiss notification"><X size={16} /></button>
    </div>
  );
}
