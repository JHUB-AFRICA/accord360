import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import AgreementDetail from "./pages/AgreementDetail";
import AgreementForm from "./pages/AgreementForm";
import Agreements from "./pages/Agreements";
import Audit from "./pages/Audit";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Monitoring from "./pages/Monitoring";
import Partners from "./pages/Partners";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import WorkQueue from "./pages/WorkQueue";

const monitoringRoles = ["admin", "linkages", "me", "executive", "auditor"];
const reportingRoles = ["admin", "linkages", "executive", "auditor"];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="work" element={<WorkQueue />} />
        <Route path="agreements" element={<Agreements />} />
        <Route path="agreements/new" element={<RoleRoute roles={["admin", "linkages", "researcher"]}><AgreementForm /></RoleRoute>} />
        <Route path="agreements/:id" element={<AgreementDetail />} />
        <Route path="partners" element={<RoleRoute roles={["admin", "linkages", "executive"]}><Partners /></RoleRoute>} />
        <Route path="monitoring" element={<RoleRoute roles={monitoringRoles}><Monitoring /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute roles={reportingRoles}><Reports /></RoleRoute>} />
        <Route path="users" element={<RoleRoute roles={["admin"]}><Users /></RoleRoute>} />
        <Route path="audit" element={<RoleRoute roles={["admin", "auditor", "executive"]}><Audit /></RoleRoute>} />
        <Route path="settings" element={<RoleRoute roles={["admin"]}><Settings /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
