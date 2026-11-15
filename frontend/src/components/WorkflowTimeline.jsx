import { Check, RotateCcw } from "lucide-react";
import { WORKFLOW_STATUSES, statusLabel, statusResponsible } from "../lib/workflow";

export default function WorkflowTimeline({ agreement, compact = false }) {
  // "Returned to Researcher" is a side branch, not a step every agreement
  // passes through, so it only appears while it is the current status.
  const statuses = WORKFLOW_STATUSES.filter((status) => status !== "returned_to_researcher" || agreement.status === "returned_to_researcher");
  const currentIndex = Math.max(0, statuses.indexOf(agreement.status));
  return (
    <div className={`workflow-timeline ${compact ? "workflow-compact" : ""}`}>
      {statuses.map((status, index) => {
        const state = index < currentIndex ? "completed" : index === currentIndex ? "active" : "pending";
        return (
          <div className={`workflow-stage workflow-${state}`} key={status}>
            <div className="workflow-marker">{state === "completed" ? <Check size={14} /> : state === "active" ? <RotateCcw size={13} /> : index + 1}</div>
            <div className="workflow-stage-copy">
              <div><strong>{index + 1}. {statusLabel(status)}</strong></div>
              {!compact && <><span>{state === "active" ? statusResponsible(status) : "Workflow status"}</span><small>{state === "active" ? "Current status" : state === "completed" ? "Completed" : "Pending"}</small></>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
