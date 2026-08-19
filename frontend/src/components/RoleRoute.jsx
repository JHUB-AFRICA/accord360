import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../lib/roles";
import LoadingState from "./LoadingState";

export default function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/access-denied" state={{ home: roleHome(user.role) }} replace />;
  return children;
}
