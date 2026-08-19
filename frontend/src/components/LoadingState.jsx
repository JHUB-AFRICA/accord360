export default function LoadingState({ label = "Loading Accord360 workspace" }) {
  return <div className="state-panel" role="status" aria-live="polite"><div className="spinner" /><span>{label}</span></div>;
}
