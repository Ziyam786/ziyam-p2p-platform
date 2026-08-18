import type {
  AgentCar, AgentServiceRequest, CashLogEntry, CashLogType, CustomerVaultEntry,
  OpsTripRow, SessionUser,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Reads the double-submit CSRF cookie the backend sets alongside the session
// cookie (non-httpOnly on purpose — see backend middleware/csrf.ts) and
// echoes it back as a header on mutating requests, which is the whole
// mechanism: a cross-origin attacker page can ride the session cookie but
// can't read this one to forge a matching header.
function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|;\s*)ziyam_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { 'X-CSRF-Token': getCsrfToken() ?? '' } : {}),
      ...options.headers,
    },
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => ({})) : undefined;
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed with status ${res.status}`, res.status);
  return body as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined });
const patch = <T>(path: string, data?: unknown) => request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined });

export const authApi = {
  login: (email: string, password: string) => post<{ success: true; data: SessionUser }>('/auth/login', { email, password }),
  logout: () => post<{ success: true }>('/auth/logout'),
  me: () => get<{ success: true; data: SessionUser }>('/auth/me'),
};

// Uploads a file (photo, signature, ID document) and returns its served URL —
// multipart, so it bypasses the JSON `request()` helper above.
export async function uploadFile(file: File | Blob, filename = 'upload.jpg'): Promise<string> {
  const form = new FormData();
  form.append('file', file, filename);
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': getCsrfToken() ?? '' },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error ?? 'Upload failed', res.status);
  return body.data.url as string;
}

/** Masks Aadhaar digits via Arya before storing — used for walk-in ID photos. */
export async function uploadMaskedAadhaar(file: File | Blob, filename = 'aadhaar.jpg'): Promise<string> {
  const form = new FormData();
  form.append('file', file, filename);
  const res = await fetch(`${API_URL}/uploads/aadhaar-mask`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': getCsrfToken() ?? '' },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error ?? 'Aadhaar mask upload failed', res.status);
  return body.data.url as string;
}

export const carsApi = {
  list: () => get<{ success: true; data: AgentCar[] }>('/agent/cars'),
};

export const agentApi = {
  queue: () => get<{ success: true; count: number; data: AgentServiceRequest[] }>('/agent/service-requests'),
  updateStatus: (id: string, status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') =>
    patch<{ success: true; data: AgentServiceRequest }>(`/agent/service-requests/${id}`, { status }),
};

export const cashLogApi = {
  list: (days = 60) =>
    get<{ success: true; count: number; data: CashLogEntry[]; summary: { cashIn: number; cashOut: number; net: number } }>(`/agent/cash-log?days=${days}`),
  create: (data: { type: CashLogType; amount: number; category: string; note?: string; tripId?: string }) =>
    post<{ success: true; data: CashLogEntry }>('/agent/cash-log', data),
};

export interface OpsTripCheckInPayload {
  carId: string;
  customerName: string;
  customerMobile: string;
  startTime: string;
  pickupLocation?: string;
  odometerStart?: number;
  baseFare?: number;
  addonTotal?: number;
  depositAmount?: number;
  notes?: string;
}

export interface OpsTripHandoverPayload {
  idVerificationMethod?: 'MASKED_PHOTO' | 'DIGILOCKER';
  maskedIdPhotoUrl?: string;
  dlFrontUrl?: string;
  dlBackUrl?: string;
  dlNumber?: string;
  customerSignatureUrl?: string;
  vehiclePhotoUrls?: string[];
  depositCollected?: number;
  depositPaymentMode?: 'CASH' | 'ONLINE';
  saveIdentityToVault?: boolean;
}

export interface OpsTripCheckOutPayload {
  endTime?: string;
  odometerEnd?: number;
  fuelEst?: string;
  carWashed?: boolean;
  washingCharges?: number;
  tyreHealth?: string;
  newDamages?: string;
  amountCollected?: number;
  amountPaidGuest?: number;
  checkoutAddons?: { type: string; amount: number; note?: string }[];
  customerDecision?: string;
  refundDeposit?: boolean;
}

export const opsTripApi = {
  list: (params: { status?: string } = {}) =>
    get<{ success: true; count: number; data: OpsTripRow[] }>(`/ops-trips${params.status ? `?status=${params.status}` : ''}`),
  get: (id: string) => get<{ success: true; data: OpsTripRow }>(`/ops-trips/${id}`),
  checkIn: (data: OpsTripCheckInPayload) => post<{ success: true; data: OpsTripRow }>('/ops-trips', data),
  handover: (id: string, data: OpsTripHandoverPayload) => patch<{ success: true; data: OpsTripRow }>(`/ops-trips/${id}/handover`, data),
  checkOut: (id: string, data: OpsTripCheckOutPayload) => patch<{ success: true; data: OpsTripRow }>(`/ops-trips/${id}/checkout`, data),
  cancel: (id: string) => patch<{ success: true; data: OpsTripRow }>(`/ops-trips/${id}/cancel`),
  vaultLookup: (phone: string) => get<{ success: true; data: CustomerVaultEntry }>(`/ops-trips/vault/${encodeURIComponent(phone)}`),
  whatsappTemplates: (id: string) =>
    get<{ success: true; data: { bookingConfirmation: string; handoverConfirmation: string; returnReminder: string } }>(`/ops-trips/${id}/whatsapp-templates`),
  digilockerStart: (id: string) => post<{ success: true; data: { url: string } }>(`/ops-trips/${id}/identity/digilocker/start`),
  digilockerStatus: (id: string) =>
    get<{ success: true; data: { status: string; name?: string; address?: string } }>(`/ops-trips/${id}/identity/digilocker/status`),
};

/** Opens WhatsApp (app or web) with a prefilled message — no Business API needed. */
export function openWhatsApp(mobile: string, text: string) {
  const digits = mobile.replace(/\D/g, '');
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  window.open(`https://wa.me/${withCountryCode}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}
