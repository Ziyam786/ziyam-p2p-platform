'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, ApiError } from './api';
import type { Role, SessionUser } from './types';

// Scoped narrower than the main admin panel — this app is for ground staff
// specifically. Admins can still sign in to oversee/test it.
const AGENT_APP_ROLES: Role[] = ['AGENT', 'ADMIN'];

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(AGENT_APP_ROLES.includes(res.data.role) ? res.data : null);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        console.error('Failed to load agent session', err);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    if (!AGENT_APP_ROLES.includes(res.data.role)) {
      await authApi.logout();
      throw new ApiError('This account does not have agent access.', 403);
    }
    setUser(res.data);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
