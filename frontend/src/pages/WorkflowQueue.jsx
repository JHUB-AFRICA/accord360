import { AlertTriangle, ArrowRight, Clock3, FileCheck2, Gavel, Scale, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import KpiCard from "../components/KpiCard.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { listAgreements } from "../lib/backend.js";
import { humanize } from "../lib/format.js";

const configs = {
  approvals: {
    eyebrow: "Faculty / department approval",
    title: "Academic-fit review queue",
    description: "Requests returned by GET /agreements?stage=department_approval within your backend scope.",
    backendStages: ["department_approval"],
    route: (id) => `/agreements/${id}?tab=overview`,
    labels: ["Awaiting review", "Within 7 days", "Over 7 days", "Backend scoped"]
  },
  linkages: {
    eyebrow: "Directorate of Linkages (RPE)",
    title: "Linkages review queue",
    description: "Requests returned by GET /agreements?stage=linkages_review within your backend scope.",
    backendStages: ["linkages_review"],
    route: (id) => `/agreements/${id}?tab=overview`,
    labels: ["Awaiting review", "Within 7 days", "Over 7 days", "Approved for Legal"]
  },
  legal: {
    eyebrow: "University Legal Office",
    title: "Legal review queue",
    description: "Legally scoped records returned by GET /agreements?stage=legal_review.",
    backendStages: ["legal_review"],
    route: (id) => `/legal/${id}`,
    labels: ["In Legal review", "Within 21-day SLA", "SLA attention", "Legal approved"]
  },
  dvc: {
    eyebrow: "DVC RPE",
    title: "Endorsement queue",
    description: "Legally approved packages returned by GET /agreements?stage=dvc_approval.",
    backendStages: ["dvc_approval"],
    route: (id) => `/dvc/${id}`,
    labels: ["Awaiting endorsement", "Within 7 days", "Over 7 days", "Returned by DVC"]
  },
  signing: {
    eyebrow: "Vice Chancellor's Office",
    title: "Submission and signing queue",
    description: "VC submission and validation/signing records returned by the implemented agreements route.",
    backendStages: ["vc_submission", "validation_signing"],
    route: (id) => `/signing/${id}`,
    labels: ["VC packages", "Awaiting VC signature", "Partner signature", "Fully signed"]
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
      const grouped = await Promise.all(config.backendStages.map((stage) => listAgreements({ stage })));
      const unique = new Map(grouped.flat().map((item) => [item.id, item]));
      setRecords([...unique.values()]);
    } catch (requestError) { setError(requestError.message); }
  }, [config]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { key: "reference", label: "Agreement", render: (item) => <div className="stacked-cell"><strong>{item.reference}</strong><span>{item.title}</span></div> },
    { key: "partner_name", label: "Partner" },
    { key: "agreement_type", label: "Type", render: (item) => <StatusBadge tone="blue">{item.agreement_type}</StatusBadge> },
    { key: "department", label: "Department" },
    { key: "initiator_name", label: "Owner / Champion" },
    { key: "days_in_stage", label: "Days waiting", render: (item) => <div className="stacked-cell"><strong>{item.days_in_stage} days</strong><span>{item.days_in_stage > (mode === "legal" ? 21 : 7) ? "SLA attention" : "Within target"}</span></div> },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status}>{humanize(item.status)}</StatusBadge> },
    { key: "action", label: "Action", render: (item) => <Link className="text-link" to={config.route(item.id)}>Open review <ArrowRight size={15} /></Link> }
  ], [config, mode]);

  if (error && !records) return <><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label={`Loading ${config.title.toLowerCase()}`} />;

  const threshold = mode === "legal" ? 21 : 7;
  const overSla = records.filter((item) => item.days_in_stage > threshold || item.status === "legal_stalled").length;
  const values = mode === "signing"
    ? [records.filter((item) => item.backend_stage === "vc_submission").length, records.filter((item) => item.status === "awaiting_vc_signature").length, records.filter((item) => item.status === "awaiting_partner_signature").length, records.filter((item) => item.status === "fully_signed").length]
    : [records.length, Math.max(0, records.length - overSla), overSla, records.filter((item) => ["linkages_approved", "legal_approved", "dvc_returned"].includes(item.status)).length];
  const icons = mode === "legal" ? [Gavel, Clock3, AlertTriangle, FileCheck2] : mode === "dvc" ? [Scale, ShieldCheck, AlertTriangle, Clock3] : [FileCheck2, Clock3, AlertTriangle, ShieldCheck];
  const tones = ["blue", "green", "red", "orange"];

  return <>
    <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} />
    <section className="kpi-grid">{config.labels.map((label, index) => <KpiCard key={label} label={label} value={values[index]} tone={tones[index]} icon={icons[index]} />)}</section>
    <section className="panel data-panel"><div className="panel-head"><div><h2>Backend workflow records</h2><p>{records.length} record{records.length === 1 ? "" : "s"} available within your server-enforced scope</p></div></div><DataTable columns={columns} rows={records} onRowClick={(item) => navigate(config.route(item.id))} emptyTitle="No records in this queue" emptyText="Records will appear after the previous backend transition is completed." /></section>
  </>;
}
