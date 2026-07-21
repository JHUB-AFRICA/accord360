import { CheckCircle2 } from "lucide-react";

export const lifecycleStages = [
  { key: "initiation", short: "Initiation", detail: "Request and expected outputs" },
  { key: "department_approval", short: "Department", detail: "Academic fit and support" },
  { key: "linkages_review", short: "Linkages", detail: "Completeness and partner check" },
  { key: "legal_review", short: "Legal", detail: "Drafting, review and versioning" },
  { key: "validation_signing", short: "Signing", detail: "VC and partner signatures" },
  { key: "activation", short: "Activation", detail: "Signed record, champion and dates" },
  { key: "active", short: "Monitoring & Evaluation", detail: "Targets, actuals and evidence" },
  { key: "renewal_closure", short: "Renewal / Closure / Archive", detail: "Decision and institutional record" }
];

function stageIndex(currentStage, status) {
  if (currentStage === "active") return 6;
  if (["renewal_closure", "archived"].includes(currentStage)) return 7;
  if (currentStage === "validation_signing" && status === "fully_signed") return 5;
  return lifecycleStages.findIndex((stage) => stage.key === currentStage);
}

export default function LifecycleStrip({ currentStage = null, status = null, compact = false }) {
  const currentIndex = stageIndex(currentStage, status);
  return (
    <div className={`lifecycle-strip panel ${compact ? "lifecycle-compact" : ""}`}>
      {lifecycleStages.map((stage, index) => {
        const complete = currentIndex >= 0 && index < currentIndex;
        const current = index === currentIndex;
        return (
          <div className={`lifecycle-stage ${complete ? "complete" : ""} ${current ? "current" : ""}`} key={stage.key}>
            <div className="lifecycle-number">{complete ? <CheckCircle2 size={16} /> : index + 1}</div>
            <div className="lifecycle-copy"><strong>{stage.short}</strong>{!compact && <span>{stage.detail}</span>}</div>
          </div>
        );
      })}
    </div>
  );
}
