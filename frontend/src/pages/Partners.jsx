import { Building2, Filter, Plus, Search, UserCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import ErrorState from "../components/ErrorState.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { createPartner, listPartners } from "../lib/backend.js";

const emptyForm = { name: "", sector: "", partner_type: "Institution", country: "Kenya", contact_name: "", contact_email: "", legal_counterpart: "", liaison: "", status: "active" };

export default function Partners() {
  const { user } = useAuth();
  const location = useLocation();
  const initialStatus = new URLSearchParams(location.search).get("status") || "";
  const [filters, setFilters] = useState({ search: "", status: initialStatus });
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const canCreate = ["researcher", "linkages", "director_linkages"].includes(user.role);
  const canVerify = ["linkages", "director_linkages"].includes(user.role);

  const load = useCallback(() => {
    setError("");
    listPartners().then(setRecords).catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredRecords = useMemo(() => {
    if (!records) return null;
    const search = filters.search.trim().toLowerCase();
    return records.filter((item) => {
      const matchesSearch = !search || [item.name, item.country, item.sector, item.partner_type].some((value) => String(value || "").toLowerCase().includes(search));
      const matchesStatus = !filters.status || item.status === filters.status;
      return matchesSearch && matchesStatus;
    });
  }, [records, filters]);

  async function create() {
    if (form.name.trim().length < 2 || form.sector.trim().length < 2) {
      setError("Partner name and sector are required.");
      return;
    }
    setSubmitting(true);
    try {
      await createPartner({ ...form, contact_email: form.contact_email || null });
      setForm(emptyForm);
      setShowCreate(false);
      setMessage("Partner created.");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const columns = useMemo(() => [
    { key: "name", label: "Institution", render: (item) => <div className="partner-name-cell"><span className="partner-table-icon"><Building2 size={18} /></span><div><strong>{item.name}</strong><span>{item.sector}</span></div></div> },
    { key: "country", label: "Country" },
    { key: "partner_type", label: "Partner type" },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
    { key: "contact_name", label: "Contact" },
    { key: "contact_email", label: "Email" },
    { key: "action", label: "Action", render: (item) => canVerify ? <Link className="text-link" to={`/partners/${item.id}/verify`}><UserCheck size={15} /> Review</Link> : <Link className="text-link" to={`/partners/${item.id}`}>View profile</Link> }
  ], [canVerify]);

  return <>
    <Toast message={message} onClose={() => setMessage("")} />
    <Toast message={error} type="error" onClose={() => setError("")} />
    <PageHeader eyebrow="Partner management" title="Partner institution registry" description="GET /partners returns the complete authenticated partner registry; search and status filtering are applied locally." actions={canCreate && <button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} /> Add partner</button>} />
    <section className="panel filter-panel"><div className="search-field"><Search size={18} /><input placeholder="Search institution, country or sector…" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></div><div className="filter-controls always-open"><Filter size={17} /><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option><option value="active">Active</option><option value="under_review">Under review</option><option value="additional_information_required">Additional information required</option><option value="rejected">Rejected</option><option value="inactive">Inactive</option></select></div></section>
    <section className="panel data-panel"><div className="panel-head"><div><h2>Partner records</h2><p>{filteredRecords ? `${filteredRecords.length} institution${filteredRecords.length === 1 ? "" : "s"}` : "Loading institutions"}</p></div></div>{error && !records ? <ErrorState message={error} onRetry={load} /> : !filteredRecords ? <LoadingState label="Loading partner registry" /> : <DataTable columns={columns} rows={filteredRecords} onRowClick={(item) => navigate(`/partners/${item.id}`)} emptyTitle="No partner institutions match these filters" />}</section>

    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add partner institution" description="This uses the implemented POST /partners endpoint." footer={<><button className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-button" disabled={submitting} onClick={create}>{submitting ? "Creating…" : "Create partner"}</button></>}>
      <div className="form-grid"><FormField label="Institution name" required><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField><FormField label="Sector" required><input value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} /></FormField><FormField label="Partner type"><input value={form.partner_type} onChange={(event) => setForm({ ...form, partner_type: event.target.value })} /></FormField><FormField label="Country"><input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></FormField><FormField label="Contact name"><input value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></FormField><FormField label="Contact email"><input type="email" value={form.contact_email} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} /></FormField><FormField label="Legal counterpart"><input value={form.legal_counterpart} onChange={(event) => setForm({ ...form, legal_counterpart: event.target.value })} /></FormField><FormField label="Partner liaison"><input value={form.liaison} onChange={(event) => setForm({ ...form, liaison: event.target.value })} /></FormField></div>
    </Modal>
  </>;
}
