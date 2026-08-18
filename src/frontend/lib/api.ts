import type {
  AdminStats, AppNotification, Blackout, Booking, BookingConditionPhoto, Car, DamageClaim, DeliveryLocation, EarningsOverview,
  IncentiveProgress, PhotoAngle, ProtectionPlan, PublicSettings, PublicUser, Review, ServiceCatalogEntry, ServiceRequest, TripStage,
  UtilizationEntry, YieldSuggestion,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';
// Uploaded files are served from the API's root (/uploads/...), not under /api.
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
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
    throw new ApiError(body?.error ?? `Request failed with status ${res.status}`, res.status, body?.code);
  }
  return body as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined });
const patch = <T>(path: string, data?: unknown) => request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

/* ── Uploads ──────────────────────────────────────────────────────── */
// Car photos, RC/insurance/PUC documents, selfies, and signatures are
// uploaded as actual files (not pasted URLs) — see backend upload.routes.ts.
export const uploadsApi = {
  upload: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/uploads`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await res.json().catch(() => ({})) : undefined;
    if (!res.ok) {
      throw new ApiError(body?.error ?? `Upload failed with status ${res.status}`, res.status);
    }
    return { url: `${API_ORIGIN}${body.data.url}` };
  },
  // Manually blurs a host-drawn rectangle (license plate) on an
  // already-uploaded photo. `originalUrl` is whatever upload() returned
  // (an absolute URL); x/y/width/height are fractional [0,1] coordinates
  // relative to the rendered image element, resolution-independent — see
  // PlateBlurEditor.tsx. Returns a NEW absolute URL for the blurred copy;
  // the original stays untouched on disk for admin verification.
  blurRegion: async (
    originalUrl: string,
    region: { x: number; y: number; width: number; height: number }
  ): Promise<{ url: string }> => {
    const relativeUrl = originalUrl.startsWith(API_ORIGIN) ? originalUrl.slice(API_ORIGIN.length) : originalUrl;
    const body = await post<{ success: true; data: { url: string } }>('/uploads/blur-region', {
      url: relativeUrl,
      ...region,
    });
    return { url: `${API_ORIGIN}${body.data.url}` };
  },
};

/* ── Auth ─────────────────────────────────────────────────────────── */
export const authApi = {
  signup: (data: { fullName: string; email: string; phoneNumber: string; password: string; role?: string; referralCode?: string }) =>
    post<{ success: true; data: PublicUser }>('/auth/signup', data),
  login: (data: { email: string; password: string }) =>
    post<{ success: true; data: PublicUser }>('/auth/login', data),
  logout: () => post<{ success: true }>('/auth/logout'),
  me: () => get<{ success: true; data: PublicUser }>('/auth/me'),
  requestOtp: (phoneNumber: string) =>
    post<{ success: true; message: string; devCode?: string }>('/auth/otp/request', { phoneNumber }),
  verifyOtp: (phoneNumber: string, code: string) =>
    post<{ success: true; data: PublicUser }>('/auth/otp/verify', { phoneNumber, code }),
  loginWithSupabase: (accessToken: string) =>
    post<{ success: true; data: PublicUser }>('/auth/oauth/supabase', { accessToken }),
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
  availability: (carId: string) => get<{ success: true; data: AvailabilityRange[] }>(`/cars/${carId}/availability`),
  bookings: (carId: string) => get<{ success: true; count: number; data: Booking[] }>(`/cars/${carId}/bookings`),
  latestConditionPhotos: (carId: string) =>
    get<{ success: true; data: { asOf: string; photos: BookingConditionPhoto[] } | null }>(`/cars/${carId}/latest-condition-photos`),
  yieldSuggestion: (carId: string) => get<{ success: true; data: YieldSuggestion }>(`/cars/${carId}/yield-suggestion`),
  applyYieldSuggestion: (carId: string) => post<{ success: true; data: YieldSuggestion }>(`/cars/${carId}/apply-yield-suggestion`),
  verifyRc: (carId: string) =>
    post<{ success: true; data: { rcNumberMatches: boolean; extractedRcNo: string | null; verifiedAt: string } }>(`/cars/${carId}/verify-rc`),
  marketPulse: (city?: string) =>
    get<{ success: true; data: { city: string | null; availableCount: number; averageDailyRate: number | null; popularCategory: string | null } }>(
      `/cars/market-pulse${city ? `?city=${encodeURIComponent(city)}` : ''}`
    ),

  fleetOnboardingStatus: (carId: string) => get<{ success: true; data: FleetOnboardingStatus }>(`/cars/${carId}/fleet-onboarding`),
  submitFleetAudit: (carId: string) =>
    post<{ success: true; data: Car }>(`/cars/${carId}/fleet-onboarding/audit`, { confirmedEligible: true }),
  submitFleetSecurity: (carId: string, telematicsImei: string) =>
    patch<{ success: true; data: Car }>(`/cars/${carId}/fleet-onboarding/security`, { telematicsImei }),
  uploadFleetAgreementWetSignature: (carId: string, url: string) =>
    patch<{ success: true; data: Car; message: string }>(`/cars/${carId}/fleet-onboarding/agreement/wet-signature`, { url }),
  startFleetAgreementEsign: (carId: string) =>
    post<{ success: true; data: { esignRequestId: string } }>(`/cars/${carId}/fleet-onboarding/agreement/esign/start`),
  fleetAgreementEsignStatus: (carId: string) =>
    get<{ success: true; data: { status: string | null; downloadUrl?: string } }>(`/cars/${carId}/fleet-onboarding/agreement/esign/status`),
};

export interface FleetOnboardingStatus {
  fleetOnboardingStep: number;
  fleetManaged: boolean;
  telematicsImei: string | null;
  fleetAgreementWetSignedUrl?: string | null;
  fleetAgreementWetSignedAt?: string | null;
  fleetAgreementEsignStatus?: string | null;
  fleetAgreementEsignDownloadUrl?: string | null;
  fleetOperator: { fullName: string; phoneNumber: string; email: string } | null;
}

export interface AvailabilityRange {
  startDate: string;
  endDate: string;
  type: 'BOOKED' | 'PAUSED';
  reason?: string | null;
}

/* ── Bookings ─────────────────────────────────────────────────────── */
export interface PayuCheckoutSession {
  url: string;
  fields: Record<string, string>;
}

export const bookingsApi = {
  create: (data: {
    carId: string; startTime: string; endTime: string; totalAmount: number;
    protectionPlan?: ProtectionPlan; deliveryRequested?: boolean; promoCode?: string;
    coDriverRequested?: boolean; coDriverName?: string; coDriverLicenseNumber?: string;
  }) => post<{ success: true; bookingId: string }>('/booking', data),
  createCheckoutSession: (id: string) => post<{ success: true; data: PayuCheckoutSession }>(`/booking/${id}/checkout-session`),
  balanceCheckoutSession: (id: string) => post<{ success: true; data: PayuCheckoutSession }>(`/booking/${id}/balance-checkout-session`),
  start: (id: string) => post<{ success: true; data: Booking }>(`/booking/${id}/start`),
  complete: (id: string, otp: string) => post<{ success: true; message: string }>(`/booking/${id}/complete`, { otp }),
  endOtp: (id: string) => get<{ success: true; data: { otp: string | null } }>(`/booking/${id}/end-otp`),
  startEsign: (id: string) => post<{ success: true; data: { esignRequestId: string } }>(`/bookings/${id}/esign/start`),
  esignStatus: (id: string) => get<{ success: true; data: { status: string | null; downloadUrl?: string } }>(`/bookings/${id}/esign/status`),
  unlock: (id: string) => post<{ success: boolean; message: string }>(`/booking/${id}/unlock`),
  cancel: (id: string, data?: { reason?: string }) =>
    post<{ success: true; data: Booking; refundAmount: number; retentionPercent: number }>(`/bookings/${id}/cancel`, data),
  get: (id: string) => get<{ success: true; data: Booking }>(`/bookings/${id}`),
  myTrips: () => get<{ success: true; count: number; data: Booking[] }>('/users/me/bookings'),
  requestWash: (id: string, data?: { serviceLocation?: string; notes?: string }) =>
    post<{ success: true; message: string }>(`/booking/${id}/wash-service`, data),
  messages: (id: string) => get<{ success: true; count: number; data: TripMessage[] }>(`/bookings/${id}/messages`),
  sendMessage: (id: string, body: string) => post<{ success: true; data: TripMessage }>(`/bookings/${id}/messages`, { body }),
  conditionPhotos: (id: string) => get<{ success: true; data: BookingConditionPhoto[] }>(`/bookings/${id}/condition-photos`),
  uploadConditionPhotos: (id: string, stage: TripStage, photos: { angle: PhotoAngle; url: string }[]) =>
    post<{ success: true; data: BookingConditionPhoto[] }>(`/bookings/${id}/condition-photos`, { stage, photos }),
  shareDeliveryLocation: (id: string, latitude: number, longitude: number) =>
    post<{ success: true }>(`/bookings/${id}/delivery-location`, { latitude, longitude }),
  deliveryLocation: (id: string) => get<{ success: true; data: DeliveryLocation | null }>(`/bookings/${id}/delivery-location`),
};

/* ── Host booking review (accept/reject a paid, pending-review booking) ── */
export const hostReviewApi = {
  requests: () => get<{ success: true; count: number; data: Booking[] }>('/host/booking-requests'),
  decide: (bookingId: string, data: { decision: 'ACCEPT' | 'REJECT'; reason?: string; note?: string }) =>
    post<{ success: true; data: Booking; suggestPause?: boolean }>(`/bookings/${bookingId}/host-review`, data),
};

/* ── Damage claims (host reports damage against a completed trip's deposit) ── */
export const damageClaimApi = {
  report: (bookingId: string, data: { description: string; estimatedCost: number; images: string[] }) =>
    post<{ success: true; data: DamageClaim }>(`/bookings/${bookingId}/damage-claim`, data),
  get: (bookingId: string) => get<{ success: true; data: DamageClaim | null }>(`/bookings/${bookingId}/damage-claim`),
};

/* ── Itinerary unlocks ────────────────────────────────────────────── */
export type ItineraryDestination = 'Ooty' | 'Coorg' | 'Chikmagalur' | 'Gokarna';

export interface ItineraryUnlock {
  id: string;
  destination: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  status: 'PENDING_PAYMENT' | 'PAID' | 'FAILED';
  generatedContent: string | null;
  createdAt: string;
}

export const itinerariesApi = {
  unlock: (data: { destination: ItineraryDestination; customerName: string; customerEmail: string; customerPhone: string }) =>
    post<{ success: true; data: PayuCheckoutSession & { id: string } }>('/itineraries/unlock', data),
  get: (id: string) => get<{ success: true; data: ItineraryUnlock }>(`/itineraries/${id}`),
};

export interface TripMessage {
  id: string;
  bookingId: string;
  senderId: string;
  sender: { id: string; fullName: string; avatarUrl?: string | null };
  body: string;
  read: boolean;
  createdAt: string;
}

/* ── Users ────────────────────────────────────────────────────────── */
export const usersApi = {
  me: () => get<{ success: true; data: PublicUser }>('/users/me'),
  update: (data: Partial<Pick<PublicUser, 'fullName' | 'bio' | 'avatarUrl' | 'payoutAccountId' | 'signatureUrl' | 'selfieUrl' | 'alternatePhoneNumber'>>) =>
    patch<{ success: true; data: PublicUser }>('/users/me', data),
  uploadPartnerAgreementWetSignature: (url: string) =>
    patch<{ success: true; data: PublicUser }>('/users/me/partner-agreement/wet-signature', { url }),
  startPartnerAgreementEsign: () =>
    post<{ success: true; data: { esignRequestId: string } }>('/users/me/partner-agreement/esign/start'),
  partnerAgreementEsignStatus: () =>
    get<{ success: true; data: { status: string | null; downloadUrl?: string } }>('/users/me/partner-agreement/esign/status'),
  verifyBankAccount: (ifsc: string, accountNumber: string) =>
    post<{ success: true; data: PublicUser }>('/users/me/bank/verify', { ifsc, accountNumber }),
  registerPushToken: (token: string, platform?: string) =>
    post<{ success: true }>('/users/me/push-token', { token, platform }),
  unregisterPushToken: (token: string) =>
    request<{ success: true }>('/users/me/push-token', { method: 'DELETE', body: JSON.stringify({ token }) }),
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
  verifyDrivingLicense: (docBase64?: string, selfieBase64?: string) =>
    post<{
      success: true;
      data: { id: string; isDrivingLicenseVerified: boolean; isSelfieVerified: boolean };
      selfieCheck: { attempted: boolean; passed?: boolean };
    }>('/kyc/driving-license', { docBase64, selfieBase64 }),
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
