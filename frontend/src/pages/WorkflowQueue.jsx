import { AlertTriangle, ArrowRight, Clock3, FileCheck2, Gavel, Scale, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import ErrorState from "../components/ErrorState";
import KpiCard from "../components/KpiCard";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { api } from "../lib/api";
import { stageLabel } from "../lib/workflow";

const configs = {
  approvals: {
    eyebrow: "Faculty / department approval",
    title: "Academic-fit review queue",
    description: "Review requests assigned to your faculty scope. Approval, return and rejection decisions require auditable comments.",
    stage: "faculty_review",
    route: (id) => `/agreements/${id}?tab=overview`,
    kpis: [["Awaiting review", "orange"], ["Within SLA", "green"], ["Overdue", "red"], ["Returned this month", "slate"]]
  },
  linkages: {
    eyebrow: "Directorate of Linkages (RPE)",
    title: "Linkages review queue",
    description: "Confirm partner legitimacy, strategic fit, Champion ownership, template alignment and document completeness before Legal review.",
    stage: "linkages_review",
    route: (id) => `/agreements/${id}?tab=overview`,
    kpis: [["Awaiting review", "orange"], ["Within SLA", "green"], ["Overdue", "red"], ["Sent to Legal", "blue"]]
  },
  legal: {
    eyebrow: "University Legal Office",
    title: "Legal review queue",
    description: "Prioritize draft comparison, clause comments, unresolved blocking issues and legal-review SLA.",
    stage: "legal_review",
    route: (id) => `/legal/${id}`,
    kpis: [["In queue", "orange"], ["Blocking comments", "red"], ["Approved this week", "green"], ["Average review", "blue"]]
  },
  dvc: {
    eyebrow: "DVC RPE",
    title: "Endorsement queue",
    description: "Review legally approved packages and either endorse them for VC submission or return them with mandatory remarks.",
    stage: "dvc_endorsement",
    route: (id) => `/dvc/${id}`,
    kpis: [["Awaiting endorsement", "orange"], ["Within SLA", "green"], ["Overdue", "red"], ["Endorsed this month", "blue"]]
  },
  signing: {
    eyebrow: "Vice Chancellor's Office",
    title: "Submission and signing queue",
    description: "Manage complete VC packages, JKUAT signatures, partner signatures and final executed-document upload.",
    stages: ["vc_submission", "signing", "signed_upload"],
    route: (id) => `/signing/${id}`,
    kpis: [["Packages received", "blue"], ["Awaiting VC signature", "orange"], ["Partner signature pending", "orange"], ["Executed this quarter", "green"]]
  }
};

export default function WorkflowQueue({ mode }) {
  const config = configs[mode];
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError("");
    try {
      const all = await api("/agreements");
      setRecords(all.filter((item) => config.stage ? item.stage === config.stage : config.stages.includes(item.stage)));
    } catch (requestError) { setError(requestError.message); }
  }, [config]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { key: "reference", label: "Agreement", render: (item) => <div className="stacked-cell"><strong>{item.reference}</strong><span>{item.title}</span></div> },
    { key: "partner_name", label: "Partner" },
    { key: "agreement_type", label: "Type", render: (item) => <StatusBadge tone="blue">{item.agreement_type}</StatusBadge> },
    { key: "faculty", label: "Faculty / department", render: (item) => <div className="stacked-cell"><strong>{item.faculty}</strong><span>{item.department}</span></div> },
    { key: "champion_name", label: "Champion", render: (item) => item.champion_name || <StatusBadge tone="orange">Unassigned</StatusBadge> },
    { key: "days_in_stage", label: "Days waiting", render: (item) => <div className="stacked-cell"><strong>{item.days_in_stage} days</strong><span>{item.days_in_stage > 7 ? "SLA attention" : "Within target"}</span></div> },
    { key: "risk", label: "Priority", render: (item) => <StatusBadge status={item.days_in_stage > 7 ? "high" : item.risk} risk /> },
    { key: "action", label: "Action", render: (item) => <Link className="text-link" to={config.route(item.id)}>Open review <ArrowRight size={15} /></Link> }
  ], [config]);

  if (error) return <><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label={`Loading ${config.title.toLowerCase()}`} />;

  const overdue = records.filter((item) => item.days_in_stage > 7).length;
  const values = mode === "legal" ? [records.length, records.flatMap((item) => item.legal_comments || []).filter((item) => item.blocking && item.status !== "resolved").length, 4, "6.2 days"] : mode === "dvc" ? [records.length, Math.max(0, records.length - overdue), overdue, 5] : mode === "signing" ? [records.filter((item) => item.stage === "vc_submission").length, records.filter((item) => item.status === "awaiting_vc_signature").length, records.filter((item) => item.status === "awaiting_partner_signature").length, 4] : [records.length, Math.max(0, records.length - overdue), overdue, 2];
  const icons = mode === "legal" ? [Gavel, AlertTriangle, FileCheck2, Clock3] : mode === "dvc" ? [Scale, ShieldCheck, AlertTriangle, Clock3] : [FileCheck2, Clock3, AlertTriangle, ShieldCheck];

  return <>
    <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} />
    <section className="kpi-grid">{config.kpis.map(([label, tone], index) => <KpiCard key={label} label={label} value={values[index]} tone={tone} icon={icons[index]} />)}</section>
    <section className="panel data-panel"><div className="panel-head"><div><h2>{stageLabel(config.stage || config.stages[0])} records</h2><p>{records.length} record{records.length === 1 ? "" : "s"} available within your scope</p></div></div><DataTable columns={columns} rows={records} onRowClick={(item) => navigate(config.route(item.id))} emptyTitle="No records in this queue" emptyText="Records will appear after the previous approval gate is completed." /></section>
  </>;
}
