'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, ApiError } from './api';
import type { PublicUser } from './types';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  requestLoginOtp: (phoneNumber: string) => Promise<{ devCode?: string }>;
  loginWithOtp: (phoneNumber: string, code: string) => Promise<PublicUser>;
  loginWithSupabase: (accessToken: string) => Promise<PublicUser>;
  loginWithFirebase: (idToken: string) => Promise<PublicUser>;
  signup: (data: { fullName: string; email: string; phoneNumber: string; password: string; role?: string; referralCode?: string }) => Promise<PublicUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(res.data);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        console.error('Failed to load session', err);
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
    const res = await authApi.login({ email, password });
    setUser(res.data);
    return res.data;
  }, []);

  const requestLoginOtp = useCallback(async (phoneNumber: string) => {
    const res = await authApi.requestOtp(phoneNumber);
    return { devCode: res.devCode };
  }, []);

  const loginWithOtp = useCallback(async (phoneNumber: string, code: string) => {
    const res = await authApi.verifyOtp(phoneNumber, code);
    setUser(res.data);
    return res.data;
  }, []);

  const loginWithSupabase = useCallback(async (accessToken: string) => {
    const res = await authApi.loginWithSupabase(accessToken);
    setUser(res.data);
    return res.data;
  }, []);

  const loginWithFirebase = useCallback(async (idToken: string) => {
    const res = await authApi.loginWithFirebase(idToken);
    setUser(res.data);
    return res.data;
  }, []);

  const signup = useCallback(async (data: { fullName: string; email: string; phoneNumber: string; password: string; role?: string; referralCode?: string }) => {
    const res = await authApi.signup(data);
    setUser(res.data);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, requestLoginOtp, loginWithOtp, loginWithSupabase, loginWithFirebase, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
