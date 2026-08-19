import { Check, RotateCcw } from "lucide-react";
import { WORKFLOW_STAGES, stageIndex } from "../lib/workflow";
import { formatDate } from "../lib/format";

export default function WorkflowTimeline({ agreement, compact = false }) {
  const currentIndex = stageIndex(agreement.stage, agreement.backend_stage, agreement.status);
  const history = agreement.lifecycle_history || [];
  return (
    <div className={`workflow-timeline ${compact ? "workflow-compact" : ""}`}>
      {WORKFLOW_STAGES.map((stage, index) => {
        const historyItem = [...history].reverse().find((item) => item.stage === stage.key);
        const state = historyItem?.status === "completed" || index < currentIndex ? "completed" : index === currentIndex ? "active" : "pending";
        return (
          <div className={`workflow-stage workflow-${state}`} key={stage.key}>
            <div className="workflow-marker">{state === "completed" ? <Check size={14} /> : state === "active" ? <RotateCcw size={13} /> : stage.number}</div>
            <div className="workflow-stage-copy">
              <div><strong>{stage.number}. {stage.label}</strong>{stage.optional && <span className="optional-label">where required</span>}</div>
              {!compact && <><span>{historyItem?.responsible || stage.responsible}</span><small>{historyItem?.completed_at ? `Completed ${formatDate(historyItem.completed_at)}` : historyItem?.started_at ? `Started ${formatDate(historyItem.started_at)}` : state === "active" ? `${agreement.days_in_stage || 0} days in stage` : "Pending"}</small></>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
