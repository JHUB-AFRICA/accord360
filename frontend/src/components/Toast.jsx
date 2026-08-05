export default function Toast({ message, type = "success", onClose }) {
  if (!message) return null;
  return (
    <button className={`toast toast-${type}`} onClick={onClose} aria-label="Dismiss notification">
      {message}
    </button>
  );
}
