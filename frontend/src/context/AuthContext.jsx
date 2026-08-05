import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { USE_MOCK_API } from "../lib/api.js";
import { getCurrentUser, loginRequest } from "../lib/backend.js";

const AuthContext = createContext(null);

function storedUser() {
  try {
    const raw = localStorage.getItem("accord360_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(storedUser);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("accord360_token")));
  const [sessionMessage, setSessionMessage] = useState("");

  const logout = useCallback((message = "") => {
    localStorage.removeItem("accord360_token");
    localStorage.removeItem("accord360_user");
    setUser(null);
    setSessionMessage(message);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accord360_token");
    if (!token) {
      setLoading(false);
      return;
    }
    getCurrentUser()
      .then((data) => {
        setUser(data);
        localStorage.setItem("accord360_user", JSON.stringify(data));
      })
      .catch(() => logout("Your session has expired. Please sign in again."))
      .finally(() => setLoading(false));
  }, [logout]);

  useEffect(() => {
    const handleUnauthorized = () => logout("Your session has expired or is no longer authorized.");
    window.addEventListener("accord360:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("accord360:unauthorized", handleUnauthorized);
  }, [logout]);

  async function login(email, password) {
    setSessionMessage("");
    const data = await loginRequest(email, password);
    localStorage.setItem("accord360_token", data.access_token);
    localStorage.setItem("accord360_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function clearSessionMessage() {
    setSessionMessage("");
  }

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    sessionMessage,
    clearSessionMessage,
    isMockMode: USE_MOCK_API
  }), [user, loading, sessionMessage, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
