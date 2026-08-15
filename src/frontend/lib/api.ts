import type {
  AdminStats, AppNotification, Blackout, Booking, Car, EarningsOverview, IncentiveProgress, ProtectionPlan, PublicSettings, PublicUser,
  Review, ServiceCatalogEntry, ServiceRequest, UtilizationEntry,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => ({})) : undefined;

  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed with status ${res.status}`, res.status);
  }
  return body as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined });
const patch = <T>(path: string, data?: unknown) => request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

/* ── Auth ─────────────────────────────────────────────────────────── */
export const authApi = {
  signup: (data: { fullName: string; email: string; phoneNumber: string; password: string; role?: string; referralCode?: string }) =>
    post<{ success: true; data: PublicUser }>('/auth/signup', data),
  login: (data: { email: string; password: string }) =>
    post<{ success: true; data: PublicUser }>('/auth/login', data),
  logout: () => post<{ success: true }>('/auth/logout'),
  me: () => get<{ success: true; data: PublicUser }>('/auth/me'),
};

/* ── Cars ─────────────────────────────────────────────────────────── */
export type CarFilters = {
  city?: string;
  category?: string;
  transmission?: string;
  fuelType?: string;
  maxPrice?: number;
  availableOnly?: boolean;
  q?: string;
  sort?: string;
};

function toQuery(params: Record<string, unknown>) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

export const carsApi = {
  list: (filters: CarFilters = {}) => get<{ success: true; count: number; data: Car[] }>(`/cars${toQuery(filters)}`),
  get: (id: string) => get<{ success: true; data: Car & { reviews: Review[] } }>(`/cars/${id}`),
  update: (id: string, data: Partial<Car>) => patch<{ success: true; data: Car }>(`/cars/${id}`, data),
  delist: (id: string) => del<{ success: true }>(`/cars/${id}`),
  toggleWishlist: (id: string) => post<{ success: true; wishlisted: boolean }>(`/cars/${id}/wishlist`),
  blackouts: (carId: string) => get<{ success: true; count: number; data: Blackout[] }>(`/cars/${carId}/blackouts`),
  addBlackout: (carId: string, data: { startDate: string; endDate: string; reason?: string }) =>
    post<{ success: true; data: Blackout }>(`/cars/${carId}/blackouts`, data),
  deleteBlackout: (id: string) => del<{ success: true }>(`/blackouts/${id}`),
  reviewSummary: (carId: string) =>
    get<{ success: true; data: { summary: string | null; positiveTags: string[]; negativeTags: string[] } }>(`/cars/${carId}/review-summary`),
  incentives: (carId: string) => get<{ success: true; data: IncentiveProgress | null }>(`/cars/${carId}/incentives`),
};

/* ── Bookings ─────────────────────────────────────────────────────── */
export interface PayuCheckoutSession {
  url: string;
  fields: Record<string, string>;
}

export const bookingsApi = {
  create: (data: {
    carId: string; startTime: string; endTime: string; totalAmount: number;
    protectionPlan?: ProtectionPlan; deliveryRequested?: boolean; promoCode?: string;
  }) => post<{ success: true; bookingId: string }>('/booking', data),
  createCheckoutSession: (id: string) => post<{ success: true; data: PayuCheckoutSession }>(`/booking/${id}/checkout-session`),
  start: (id: string) => post<{ success: true; data: Booking }>(`/booking/${id}/start`),
  complete: (id: string, otp: string) => post<{ success: true; message: string }>(`/booking/${id}/complete`, { otp }),
  endOtp: (id: string) => get<{ success: true; data: { otp: string | null } }>(`/booking/${id}/end-otp`),
  startEsign: (id: string) => post<{ success: true; data: { esignRequestId: string } }>(`/bookings/${id}/esign/start`),
  esignStatus: (id: string) => get<{ success: true; data: { status: string | null; downloadUrl?: string } }>(`/bookings/${id}/esign/status`),
  unlock: (id: string) => post<{ success: boolean; message: string }>(`/booking/${id}/unlock`),
  cancel: (id: string) => post<{ success: true; data: Booking }>(`/bookings/${id}/cancel`),
  get: (id: string) => get<{ success: true; data: Booking }>(`/bookings/${id}`),
  myTrips: () => get<{ success: true; count: number; data: Booking[] }>('/users/me/bookings'),
};

/* ── Users ────────────────────────────────────────────────────────── */
export const usersApi = {
  me: () => get<{ success: true; data: PublicUser }>('/users/me'),
  update: (data: Partial<Pick<PublicUser, 'fullName' | 'bio' | 'avatarUrl' | 'payoutAccountId' | 'signatureUrl' | 'selfieUrl' | 'alternatePhoneNumber'>>) =>
    patch<{ success: true; data: PublicUser }>('/users/me', data),
};

/* ── KYC ──────────────────────────────────────────────────────────── */
export const kycApi = {
  submit: (docUrl: string) => post<{ success: true; message: string; data: { isKycVerified: boolean } }>('/kyc/submit', { docUrl }),
  sendAadhaarOtp: (aadhaarNumber: string) =>
    post<{ success: true; stubbed: boolean; referenceId?: string | number; message: string }>('/kyc/aadhaar/otp', { aadhaarNumber }),
  verifyAadhaarOtp: (referenceId: string | number | undefined, otp: string | undefined) =>
    post<{ success: true; message: string; data: { isKycVerified: boolean; aadhaarVerifiedName?: string } }>('/kyc/aadhaar/verify', { referenceId, otp }),
  startDigilocker: () => post<{ success: true; data: { url: string } }>('/kyc/digilocker/start'),
  digilockerStatus: () => get<{ success: true; data: { status: string; isKycVerified: boolean } }>('/kyc/digilocker/status'),
};

/* ── Bank account verification ───────────────────────────────────── */
export const bankApi = {
  verify: (ifsc: string, accountNumber: string) =>
    post<{ success: true; data: PublicUser }>('/users/me/bank/verify', { ifsc, accountNumber }),
};

/* ── Reviews ──────────────────────────────────────────────────────── */
export const reviewsApi = {
  create: (data: { bookingId: string; rating: number; comment?: string }) =>
    post<{ success: true; data: Review }>('/reviews', data),
  forCar: (carId: string) => get<{ success: true; count: number; data: Review[] }>(`/cars/${carId}/reviews`),
  forHost: (hostId: string) => get<{ success: true; count: number; data: Review[] }>(`/hosts/${hostId}/reviews`),
};

/* ── Host / Fleet ─────────────────────────────────────────────────── */
export const hostApi = {
  myCars: (hostId: string) => get<{ success: true; count: number; data: Car[] }>(`/host/${hostId}/cars`),
  addCar: (hostId: string, data: Partial<Car> & { make: string; model: string; registrationNo: string; year: number; dailyRate: number; city: string }) =>
    post<{ success: true; data: Car }>(`/host/${hostId}/cars`, data),
  earnings: (hostId: string) => get<{ success: true; data: EarningsOverview }>(`/host/${hostId}/earnings`),
  utilization: (hostId: string) => get<{ success: true; data: UtilizationEntry[] }>(`/host/${hostId}/utilization`),
};

/* ── Public host profiles ─────────────────────────────────────────── */
export const publicHostApi = {
  profile: (hostId: string) => get<{ success: true; data: PublicUser }>(`/hosts/${hostId}`),
  cars: (hostId: string) => get<{ success: true; count: number; data: Car[] }>(`/hosts/${hostId}/cars`),
  reviews: (hostId: string) => get<{ success: true; count: number; data: Review[] }>(`/hosts/${hostId}/reviews`),
};

/* ── Public settings (CMS-driven site content) ───────────────────── */
export const settingsApi = {
  public: () => get<{ success: true; data: PublicSettings }>('/settings/public'),
};

/* ── AI support chatbot ───────────────────────────────────────────── */
export const aiApi = {
  chat: (sessionId: string, message: string) =>
    post<{ success: true; reply: string }>('/ai/chat', { sessionId, message }),
};

/* ── Promo codes ──────────────────────────────────────────────────── */
export const promoApi = {
  validate: (code: string, subtotal: number) =>
    post<{ success: true; data: { code: string; discount: number } }>('/promo-codes/validate', { code, subtotal }),
};

/* ── Wishlist ─────────────────────────────────────────────────────── */
export const wishlistApi = {
  list: () => get<{ success: true; count: number; data: Car[] }>('/users/me/wishlist'),
};

/* ── Notifications ────────────────────────────────────────────────── */
export const notificationsApi = {
  list: () => get<{ success: true; count: number; unreadCount: number; data: AppNotification[] }>('/users/me/notifications'),
  markRead: (id: string) => post<{ success: true; data: AppNotification }>(`/notifications/${id}/read`),
  markAllRead: () => post<{ success: true }>('/notifications/read-all'),
};

/* ── Vehicle Services (maintenance booking) ──────────────────────────── */
export const serviceApi = {
  catalog: () => get<{ success: true; data: ServiceCatalogEntry[] }>('/services/catalog'),
  list: (carId?: string) => get<{ success: true; count: number; data: ServiceRequest[] }>(`/services${carId ? `?carId=${carId}` : ''}`),
  create: (data: { carId: string; serviceType: string; priceEstimate: number; scheduledDate: string; serviceLocation: string; notes?: string }) =>
    post<{ success: true; data: ServiceRequest }>('/services', data),
  updateStatus: (id: string, status: string, paymentMode?: string) =>
    patch<{ success: true; data: ServiceRequest }>(`/services/${id}`, { status, paymentMode }),
};

/* ── Admin ────────────────────────────────────────────────────────── */
export const adminApi = {
  stats: () => get<{ success: true; data: AdminStats }>('/admin/stats'),
  bookings: (status?: string) => get<{ success: true; count: number; data: Booking[] }>(`/admin/bookings${toQuery({ status })}`),
  users: (role?: string) => get<{ success: true; count: number; data: PublicUser[] }>(`/admin/users${toQuery({ role })}`),
};
