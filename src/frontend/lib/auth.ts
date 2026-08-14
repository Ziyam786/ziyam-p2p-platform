'use client';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: 'CUSTOMER' | 'SELF_HOST' | 'FLEET_OPERATOR' | 'ADMIN';
  isKycVerified: boolean;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_KEY = 'ziyam_access_token';
const REFRESH_TOKEN_KEY = 'ziyam_refresh_token';
const USER_KEY = 'ziyam_user';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

function storeSession(user: AuthUser, tokens: AuthTokens) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

async function parseJsonOrThrow(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Request failed with status ${res.status}`);
  }
  return json;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await parseJsonOrThrow(res);
  storeSession(json.data, { accessToken: json.accessToken, refreshToken: json.refreshToken });
  return json.data;
}

export async function register(params: {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'CUSTOMER' | 'SELF_HOST';
}): Promise<AuthUser> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await parseJsonOrThrow(res);
  storeSession(json.data, { accessToken: json.accessToken, refreshToken: json.refreshToken });
  return json.data;
}

export async function logout(): Promise<void> {
  const refreshToken = isBrowser() ? window.localStorage.getItem(REFRESH_TOKEN_KEY) : null;
  clearSession();
  if (!refreshToken) return;
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Best-effort server-side revocation; local session is already cleared.
  }
}

/** Fetch wrapper that attaches the stored access token to Authorization header. */
export async function authFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
