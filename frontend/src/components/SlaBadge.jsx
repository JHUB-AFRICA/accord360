import { Clock3 } from "lucide-react";

const labels = {
  within_sla: "Within SLA",
  warning: "SLA warning",
  breached: "SLA breached",
  not_configured: "Timer active"
};

export default function SlaBadge({ state = "not_configured", days = 0, target = null }) {
  const tone = state === "breached" ? "red" : state === "warning" ? "orange" : state === "within_sla" ? "green" : "neutral";
  return (
    <span className={`sla-badge sla-${tone}`} title={target ? `${days} of ${target} days` : `${days} days in current stage`}>
      <Clock3 size={13} />
      {labels[state] || "Stage timer"} · {days}d
    </span>
  );
}
