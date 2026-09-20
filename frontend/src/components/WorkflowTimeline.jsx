import { Check, RotateCcw } from "lucide-react";
import { WORKFLOW_STATUSES, statusLabel } from "../lib/workflow";
import { formatDate } from "../lib/format";

export default function WorkflowTimeline({ agreement, compact = false }) {
  const currentIndex = Math.max(0, WORKFLOW_STATUSES.indexOf(agreement.status));
  return (
    <div className={`workflow-timeline ${compact ? "workflow-compact" : ""}`}>
      {WORKFLOW_STATUSES.map((status, index) => {
        const state = index < currentIndex ? "completed" : index === currentIndex ? "active" : "pending";
        return (
          <div className={`workflow-stage workflow-${state}`} key={status}>
            <div className="workflow-marker">{state === "completed" ? <Check size={14} /> : state === "active" ? <RotateCcw size={13} /> : index + 1}</div>
            <div className="workflow-stage-copy">
              <div><strong>{index + 1}. {statusLabel(status)}</strong></div>
              {!compact && <><span>{state === "active" ? agreement.next_office || "Current owner" : "Workflow status"}</span><small>{state === "active" ? "Current status" : state === "completed" ? "Completed" : "Pending"}</small></>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
