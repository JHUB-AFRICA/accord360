import { Navigate, Route, Routes } from "react-router-dom";
import AccountState from "./pages/AccountState.jsx";
import AgreementDetail from "./pages/AgreementDetail.jsx";
import AgreementForm from "./pages/AgreementForm.jsx";
import Agreements from "./pages/Agreements.jsx";
import Configuration from "./pages/Configuration.jsx";
import CorrectionDetail from "./pages/CorrectionDetail.jsx";
import Corrections from "./pages/Corrections.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Help from "./pages/Help.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import Login from "./pages/Login.jsx";
import Monitoring from "./pages/Monitoring.jsx";
import NotFound from "./pages/NotFound.jsx";
import Notifications from "./pages/Notifications.jsx";
import PartnerDetail from "./pages/PartnerDetail.jsx";
import PartnerVerification from "./pages/PartnerVerification.jsx";
import Partners from "./pages/Partners.jsx";
import Reports from "./pages/Reports.jsx";
import SixMonthReport from "./pages/SixMonthReport.jsx";
import WorkflowQueue from "./pages/WorkflowQueue.jsx";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PublicLayout from "./components/PublicLayout.jsx";
import RoleHomeRedirect from "./components/RoleHomeRedirect.jsx";
import RoleRoute from "./components/RoleRoute.jsx";
import { ALL_ROLES, INTERNAL_ROLES } from "./lib/roles.js";


const role = (roles, element) => <RoleRoute roles={roles}>{element}</RoleRoute>;
const agreementCreators = ["researcher", "linkages"];
const correctionRoles = ["researcher", "linkages", "legal"];
const reportRoles = ["linkages", "me"];

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-email" element={<AccountState type="verify-email" />} />
      <Route path="/pending-review" element={<AccountState type="pending-review" />} />
      <Route path="/suspended" element={<AccountState type="suspended" />} />
      <Route path="/password-reset-success" element={<AccountState type="password-reset-success" />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/workspace" element={<RoleHomeRedirect />} />
        <Route path="/access-denied" element={<AccountState type="access-denied" />} />

        <Route path="/researcher" element={role(["researcher"], <Dashboard />)} />
        <Route path="/linkages" element={role(["linkages"], <Dashboard />)} />
        <Route path="/linkages/queue" element={role(["linkages"], <WorkflowQueue mode="linkages" />)} />
        <Route path="/legal" element={role(["legal"], <Dashboard />)} />
        <Route path="/legal/queue" element={role(["legal"], <WorkflowQueue mode="legal" />)} />
        <Route path="/legal/:id" element={role(["legal"], <AgreementDetail defaultTab="corrections" />)} />
        <Route path="/monitoring" element={role(["me", "researcher", "linkages"], <Monitoring />)} />
        <Route path="/monitoring/reports" element={role(["me", "researcher", "linkages"], <Monitoring view="reports" />)} />
        <Route path="/monitoring/reports/:id" element={role(["me", "researcher", "linkages"], <SixMonthReport />)} />

        <Route path="/agreements" element={role(INTERNAL_ROLES, <Agreements />)} />
        <Route path="/agreements/new" element={role(agreementCreators, <AgreementForm />)} />
        <Route path="/agreements/:id" element={role(INTERNAL_ROLES, <AgreementDetail />)} />
        <Route path="/partners" element={role(["researcher", "linkages"], <Partners />)} />
        <Route path="/partners/:id" element={role(["researcher", "linkages"], <PartnerDetail />)} />
        <Route path="/partners/:id/verify" element={role(["linkages"], <PartnerVerification />)} />
        <Route path="/corrections" element={role(correctionRoles, <Corrections />)} />
        <Route path="/corrections/:id" element={role(correctionRoles, <CorrectionDetail />)} />
        <Route path="/notifications" element={role(ALL_ROLES, <Notifications />)} />
        <Route path="/reports" element={role(reportRoles, <Reports />)} />
        {/* Re-homed from the removed `admin` role to `linkages` per
            REBUILD_BRIEF.md Section 1 ("if a capability seems to need an admin
            role, it belongs to linkages instead") and Section 5.1's
            linkages-owned template admin screen. */}
        <Route path="/configuration" element={role(["linkages"], <Configuration />)} />
        <Route path="/help" element={role(ALL_ROLES, <Help />)} />
      </Route>

      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
