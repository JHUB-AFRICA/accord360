import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { demoUsers } from "../lib/demoData";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("accord360_user")); } catch { return null; } });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("accord360_token")));
  useEffect(() => {
    const token = localStorage.getItem("accord360_token");
    if (!token || token === "demo-token") { setLoading(false); return; }
    api("/auth/me").then((data) => { setUser(data); localStorage.setItem("accord360_user", JSON.stringify(data)); }).catch(() => logout()).finally(() => setLoading(false));
  }, []);
  async function login(email, password) {
    try {
      const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem("accord360_token", data.access_token); localStorage.setItem("accord360_user", JSON.stringify(data.user)); setUser(data.user); return data.user;
    } catch (error) {
      const demo = demoUsers[email.trim().toLowerCase()];
      if (!demo) throw error;
      localStorage.setItem("accord360_token", "demo-token"); localStorage.setItem("accord360_user", JSON.stringify(demo)); setUser(demo); return demo;
    }
  }
  function logout() { localStorage.removeItem("accord360_token"); localStorage.removeItem("accord360_user"); setUser(null); }
  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
