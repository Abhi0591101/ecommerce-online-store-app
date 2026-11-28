import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchMe,
  getStoredToken,
  login as loginApi,
  logoutApi,
  setStoredToken
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(!!getStoredToken());

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetchMe();
        if (!cancelled) setUser(res.data);
      } catch {
        if (!cancelled) {
          setStoredToken('');
          setToken('');
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const applySession = useCallback((nextToken, nextUser) => {
    setStoredToken(nextToken || '');
    setToken(nextToken || '');
    setUser(nextUser || null);
    return nextUser;
  }, []);

  const login = useCallback(async ({ phone, password, role }) => {
    const res = await loginApi({ phone, password, role });
    return applySession(res.data?.token, res.data?.user);
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) await logoutApi();
    } catch {
      /* still clear local session */
    }
    setStoredToken('');
    setToken('');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await fetchMe();
    setUser(res.data);
    return res.data;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!user && !!token,
      login,
      logout,
      applySession,
      refreshUser,
      setUser
    }),
    [user, token, loading, login, logout, applySession, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
