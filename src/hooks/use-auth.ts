"use client";

import { useState, useEffect, useCallback } from "react";

interface AuthState {
  authenticated: boolean;
  username: string | null;
  loading: boolean;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    authenticated: false,
    username: null,
    loading: true,
  });

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setAuth({
          authenticated: data.authenticated,
          username: data.username,
          loading: false,
        });
      } else {
        setAuth({ authenticated: false, username: null, loading: false });
      }
    } catch {
      setAuth({ authenticated: false, username: null, loading: false });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuth({ authenticated: false, username: null, loading: false });
    window.location.href = "/";
  }, []);

  return { ...auth, logout, checkAuth };
}
