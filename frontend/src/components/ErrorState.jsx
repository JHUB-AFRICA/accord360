import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorState({ title = "Unable to load this page", message, onRetry }) {
  return (
    <div className="state-panel error-state" role="alert">
      <div className="error-icon"><AlertTriangle size={25} /></div>
      <h3>{title}</h3>
      <p>{message || "Please try again or contact system support if the problem persists."}</p>
      {onRetry && <button className="secondary-button" onClick={onRetry}><RefreshCw size={16} /> Try again</button>}
    </div>
  );
}
