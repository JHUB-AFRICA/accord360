import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import AgreementDetail from "./pages/AgreementDetail";
import AgreementForm from "./pages/AgreementForm";
import Agreements from "./pages/Agreements";
import Audit from "./pages/Audit";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Monitoring from "./pages/Monitoring";
import PartnerRequests from "./pages/PartnerRequests";
import Partners from "./pages/Partners";
import Templates from "./pages/Templates";
import Reports from "./pages/Reports";
import Scorecard from "./pages/Scorecard";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import WorkQueue from "./pages/WorkQueue";

const monitoringRoles = ["admin", "linkages", "me", "executive", "auditor"];
const intakeRoles = ["admin", "linkages", "champion", "executive", "auditor"];
const templateRoles = ["admin", "linkages", "champion", "legal", "executive"];
const reportingRoles = ["admin", "linkages", "executive", "auditor"];

export default function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="work" element={<WorkQueue />} />
        <Route path="agreements" element={<Agreements />} />
        <Route path="agreements/new" element={<RoleRoute roles={["admin", "linkages", "champion"]}><AgreementForm /></RoleRoute>} />
        <Route path="requests" element={<RoleRoute roles={intakeRoles}><PartnerRequests /></RoleRoute>} />
        <Route path="templates" element={<RoleRoute roles={templateRoles}><Templates /></RoleRoute>} />
        <Route path="agreements/:id" element={<AgreementDetail />} />
        <Route path="partners" element={<RoleRoute roles={["admin", "linkages", "executive"]}><Partners /></RoleRoute>} />
        <Route path="monitoring" element={<RoleRoute roles={monitoringRoles}><Monitoring /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute roles={reportingRoles}><Reports /></RoleRoute>} />
        <Route path="scorecard" element={<RoleRoute roles={["admin", "linkages", "me", "executive", "auditor"]}><Scorecard /></RoleRoute>} />
        <Route path="users" element={<RoleRoute roles={["admin"]}><Users /></RoleRoute>} />
        <Route path="audit" element={<RoleRoute roles={["admin", "auditor", "executive"]}><Audit /></RoleRoute>} />
        <Route path="settings" element={<RoleRoute roles={["admin"]}><Settings /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
