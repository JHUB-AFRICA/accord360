export default function StatusBadge({ color = "yellow", children }) {
  return <span className={`status-badge status-${color}`}>{children}</span>;
}
