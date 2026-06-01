import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

export function useSession() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let mounted = true;

    apiRequest("/api/auth/session")
      .then((data) => {
        if (!mounted) {
          return;
        }
        setCurrentUser(data.user);
        setIsAuthenticated(true);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setCurrentUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (mounted) {
          setAuthLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogin({ username, password }) {
    setLoginLoading(true);
    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      setAuthError("");
    } catch (error) {
      setAuthError(error.message || "Invalid username or password");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear the local state even if the server session is already gone.
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAuthError("");
  }

  return {
    isAuthenticated,
    currentUser,
    authLoading,
    loginLoading,
    authError,
    handleLogin,
    handleLogout,
  };
}
