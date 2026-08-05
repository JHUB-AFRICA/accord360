import { RISK_TONES, STATUS_TONES, statusLabel } from "../lib/workflow";
import { humanize } from "../lib/format";

export default function StatusBadge({ status, tone, risk = false, children }) {
  const value = status || children || "unknown";
  const resolvedTone = tone || (risk ? RISK_TONES[value] : STATUS_TONES[value]) || "slate";
  const label = children || (risk ? humanize(value) : statusLabel(value));
  return <span className={`status-badge tone-${resolvedTone}`}>{label}</span>;
}
