import { Navigate, Route, Routes } from "react-router-dom";
import AccountState from "./pages/AccountState";
import AgreementDetail from "./pages/AgreementDetail";
import AgreementForm from "./pages/AgreementForm";
import Agreements from "./pages/Agreements";
import Audit from "./pages/Audit";
import Configuration from "./pages/Configuration";
import CorrectionDetail from "./pages/CorrectionDetail";
import Corrections from "./pages/Corrections";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import Help from "./pages/Help";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Monitoring from "./pages/Monitoring";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";
import PartnerDetail from "./pages/PartnerDetail";
import PartnerPortal from "./pages/PartnerPortal";
import PartnerRegister from "./pages/PartnerRegister";
import PartnerVerification from "./pages/PartnerVerification";
import Partners from "./pages/Partners";
import RegistrationSubmitted from "./pages/RegistrationSubmitted";
import Reports from "./pages/Reports";
import Scorecards from "./pages/Scorecards";
import SixMonthReport from "./pages/SixMonthReport";
import Users from "./pages/Users";
import WorkflowQueue from "./pages/WorkflowQueue";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicLayout from "./components/PublicLayout";
import RoleHomeRedirect from "./components/RoleHomeRedirect";
import RoleRoute from "./components/RoleRoute";
import { ALL_ROLES } from "./lib/roles";

const role = (roles, element) => <RoleRoute roles={roles}>{element}</RoleRoute>;
const operationalRoles = ALL_ROLES;
const agreementCreators = ["researcher", "linkages", "director_linkages"];
const correctionRoles = ["partner", "researcher", "approver", "linkages", "director_linkages", "legal"];
const reportRoles = ["linkages", "director_linkages", "dvc", "executive", "me", "auditor", "admin"];

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/partner/register" element={<PartnerRegister />} />
      <Route path="/partner/submitted" element={<RegistrationSubmitted />} />
      <Route path="/verify-email" element={<AccountState type="verify-email" />} />
      <Route path="/pending-review" element={<AccountState type="pending-review" />} />
      <Route path="/suspended" element={<AccountState type="suspended" />} />
      <Route path="/password-reset-success" element={<AccountState type="password-reset-success" />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/workspace" element={<RoleHomeRedirect />} />
        <Route path="/access-denied" element={<AccountState type="access-denied" />} />

        <Route path="/partner/dashboard" element={role(["partner"], <Dashboard />)} />
        <Route path="/partner/registration" element={role(["partner"], <PartnerPortal view="registration" />)} />
        <Route path="/partner/requests" element={role(["partner"], <Agreements />)} />
        <Route path="/partner/documents" element={role(["partner"], <PartnerPortal view="documents" />)} />
        <Route path="/partner/profile" element={role(["partner"], <PartnerPortal view="profile" />)} />

        <Route path="/researcher" element={role(["researcher"], <Dashboard />)} />
        <Route path="/approvals" element={role(["approver"], <Dashboard />)} />
        <Route path="/approvals/queue" element={role(["approver"], <WorkflowQueue mode="approvals" />)} />
        <Route path="/linkages" element={role(["linkages"], <Dashboard />)} />
        <Route path="/linkages/queue" element={role(["linkages", "director_linkages"], <WorkflowQueue mode="linkages" />)} />
        <Route path="/director" element={role(["director_linkages"], <Dashboard />)} />
        <Route path="/legal" element={role(["legal"], <Dashboard />)} />
        <Route path="/legal/queue" element={role(["legal"], <WorkflowQueue mode="legal" />)} />
        <Route path="/legal/:id" element={role(["legal"], <AgreementDetail defaultTab="corrections" />)} />
        <Route path="/dvc" element={role(["dvc"], <Dashboard />)} />
        <Route path="/dvc/queue" element={role(["dvc"], <WorkflowQueue mode="dvc" />)} />
        <Route path="/dvc/:id" element={role(["dvc"], <AgreementDetail defaultTab="workflow" />)} />
        <Route path="/signing" element={role(["vc_office"], <Dashboard />)} />
        <Route path="/signing/queue" element={role(["vc_office"], <WorkflowQueue mode="signing" />)} />
        <Route path="/signing/:id" element={role(["vc_office"], <AgreementDetail defaultTab="signing" />)} />
        <Route path="/monitoring" element={role(["me", "researcher", "linkages", "director_linkages"], <Monitoring />)} />
        <Route path="/monitoring/reports" element={role(["me", "researcher", "linkages", "director_linkages"], <Monitoring view="reports" />)} />
        <Route path="/monitoring/reports/:id" element={role(["me", "researcher", "linkages", "director_linkages"], <SixMonthReport />)} />
        <Route path="/scorecards" element={role(["me", "linkages", "director_linkages", "executive"], <Scorecards />)} />
        <Route path="/executive" element={role(["executive"], <Dashboard />)} />
        <Route path="/admin" element={role(["admin"], <Dashboard />)} />
        <Route path="/audit-workspace" element={role(["auditor"], <Dashboard />)} />

        <Route path="/agreements" element={role(operationalRoles, <Agreements />)} />
        <Route path="/agreements/new" element={role(agreementCreators, <AgreementForm />)} />
        <Route path="/agreements/:id" element={role(operationalRoles, <AgreementDetail />)} />
        <Route path="/partners" element={role(["linkages", "director_linkages", "admin"], <Partners />)} />
        <Route path="/partners/:id" element={role(["linkages", "director_linkages", "admin", "partner"], <PartnerDetail />)} />
        <Route path="/partners/:id/verify" element={role(["linkages", "director_linkages"], <PartnerVerification />)} />
        <Route path="/corrections" element={role(correctionRoles, <Corrections />)} />
        <Route path="/corrections/:id" element={role(correctionRoles, <CorrectionDetail />)} />
        <Route path="/notifications" element={role(operationalRoles, <Notifications />)} />
        <Route path="/reports" element={role(reportRoles, <Reports />)} />
        <Route path="/users" element={role(["admin"], <Users />)} />
        <Route path="/configuration" element={role(["admin"], <Configuration />)} />
        <Route path="/audit" element={role(["admin", "auditor", "executive", "director_linkages"], <Audit />)} />
        <Route path="/help" element={role(operationalRoles, <Help />)} />
      </Route>

      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
