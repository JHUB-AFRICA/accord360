import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleHomeRedirect from "./components/RoleHomeRedirect";
import RoleRoute from "./components/RoleRoute";
import AgreementDetail from "./pages/AgreementDetail";
import AgreementForm from "./pages/AgreementForm";
import Agreements from "./pages/Agreements";
import Audit from "./pages/Audit";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Partners from "./pages/Partners";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Users from "./pages/Users";

const allOperationalRoles = [
  "admin",
  "researcher",
  "approver",
  "linkages",
  "director_linkages",
  "legal",
  "dvc",
  "vc_office",
  "executive",
  "me",
  "auditor"
];

function workspace(path, roles) {
  return <Route path={path} element={<RoleRoute roles={roles}><Dashboard /></RoleRoute>} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<RoleHomeRedirect />} />
        {workspace("champion", ["researcher"])}
        {workspace("approvals", ["approver"])}
        {workspace("linkages", ["linkages", "director_linkages"])}
        {workspace("legal", ["legal"])}
        {workspace("dvc", ["dvc"])}
        {workspace("signing", ["vc_office"])}
        {workspace("monitoring", ["me"])}
        {workspace("executive", ["executive"])}
        {workspace("admin", ["admin"])}
        {workspace("audit-workspace", ["auditor"])}

        <Route path="agreements" element={<RoleRoute roles={allOperationalRoles}><Agreements /></RoleRoute>} />
        <Route path="agreements/new" element={<RoleRoute roles={["researcher", "linkages", "director_linkages"]}><AgreementForm /></RoleRoute>} />
        <Route path="agreements/:id" element={<RoleRoute roles={allOperationalRoles}><AgreementDetail /></RoleRoute>} />
        <Route path="partners" element={<RoleRoute roles={["linkages", "director_linkages", "admin"]}><Partners /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute roles={["linkages", "director_linkages", "dvc", "executive", "me", "auditor", "admin"]}><Reports /></RoleRoute>} />
        <Route path="users" element={<RoleRoute roles={["admin"]}><Users /></RoleRoute>} />
        <Route path="audit" element={<RoleRoute roles={["admin", "auditor", "executive", "director_linkages"]}><Audit /></RoleRoute>} />
        <Route path="settings" element={<RoleRoute roles={["admin"]}><Settings /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
