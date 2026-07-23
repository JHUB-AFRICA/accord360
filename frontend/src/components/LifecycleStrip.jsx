import { CheckCircle2 } from "lucide-react";

export const lifecycleStages = [
  { key: "initiation", short: "Initiation", detail: "Champion request and outputs" },
  { key: "linkages_review", short: "Linkages", detail: "Completeness and partner check" },
  { key: "legal_review", short: "Legal", detail: "Review, feedback and approval" },
  { key: "dvc_signoff", short: "DVC RPE", detail: "Post-legal endorsement gate" },
  { key: "vc_submission", short: "VC package", detail: "Gated submission assembly" },
  { key: "signing", short: "Signing", detail: "VC and partner signatures" },
  { key: "active", short: "Monitoring & Evaluation", detail: "Six-month reports and evidence" },
  { key: "renewal_closure", short: "Renewal / Closure / Archive", detail: "Decision and institutional record" }
];

function stageIndex(currentStage, status) {
  if (currentStage === "active") return 6;
  if (["renewal_closure", "archived"].includes(currentStage)) return 7;
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
