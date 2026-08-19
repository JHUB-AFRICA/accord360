import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../lib/roles";

export default function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={roleHome(user?.role)} replace />;
}
