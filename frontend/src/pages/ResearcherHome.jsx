import { PlusCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { listAgreements } from "../lib/backend.js";
import { formatDate, humanize } from "../lib/format.js";

// The Researcher's whole home screen (REBUILD_BRIEF.md Section 5.1): their
// own agreements, and a button to create a new one. Progress updates and
// document history live on the agreement detail page, one click away.
export default function ResearcherHome() {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(() => {
    setError("");
    listAgreements().then(setRecords).catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error && !records) return <><PageHeader eyebrow="My workspace" title="My agreements" /><ErrorState message={error} onRetry={load} /></>;
  if (!records) return <LoadingState label="Loading your agreements" />;

  const columns = [
    { key: "title", label: "Agreement", render: (item) => <div className="stacked-cell"><strong>{item.title}</strong><span>{item.partner_name}</span></div> },
    { key: "department", label: "Department" },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status}>{humanize(item.status)}</StatusBadge> },
    { key: "end_date", label: "End date", render: (item) => formatDate(item.end_date) }
  ];

  return <>
    <PageHeader
      eyebrow="My workspace"
      title="My agreements"
      description="Every collaboration you've proposed, and where it stands."
      actions={<Link className="primary-button" to="/agreements/new"><PlusCircle size={17} /> Create new agreement</Link>}
    />
    <section className="panel data-panel">
      <DataTable
        columns={columns}
        rows={records}
        onRowClick={(item) => navigate(`/agreements/${item.id}`)}
        emptyTitle="No agreements yet"
        emptyText="Create your first agreement to get started."
      />
    </section>
  </>;
}
