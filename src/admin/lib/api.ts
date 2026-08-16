import type {
  AdminBooking, AdminCar, AdminPayout, AdminReview, AdminStats, AdminUser, AuditEntry,
  BalanceSheetData, ChatConversationSummary, ChatMessageRow, CommandCenterData, FleetExpenseRow,
  FleetSummary, JournalEntryRow, MonthlyBalanceRow, OpsTripRow, OutstandingFrequency, OutstandingRow,
  OutstandingType, PlatformBookingEntry, PromoCode, SessionUser, SettingRow,
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
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => ({})) : undefined;
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed with status ${res.status}`, res.status);
  return body as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined });
const patch = <T>(path: string, data?: unknown) => request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined });
const put = <T>(path: string, data?: unknown) => request<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

export const authApi = {
  login: (email: string, password: string) => post<{ success: true; data: SessionUser }>('/auth/login', { email, password }),
  logout: () => post<{ success: true }>('/auth/logout'),
  me: () => get<{ success: true; data: SessionUser }>('/auth/me'),
};

export const adminApi = {
  stats: () => get<{ success: true; data: AdminStats }>('/admin/stats'),

  users: (role?: string) => get<{ success: true; data: AdminUser[] }>(`/admin/users${role ? `?role=${role}` : ''}`),
  updateUser: (id: string, data: Partial<Pick<AdminUser, 'isSuspended' | 'isKycVerified' | 'role'>>) =>
    patch<{ success: true; data: AdminUser }>(`/admin/users/${id}`, data),

  cars: () => get<{ success: true; data: AdminCar[] }>('/admin/cars'),
  updateCar: (id: string, data: Partial<Pick<AdminCar, 'isAvailable' | 'featured' | 'dailyRate' | 'city' | 'category'>>) =>
    patch<{ success: true; data: AdminCar }>(`/admin/cars/${id}`, data),

  bookings: (status?: string) => get<{ success: true; data: AdminBooking[] }>(`/admin/bookings${status ? `?status=${status}` : ''}`),
  updateBooking: (id: string, status: string) => patch<{ success: true; data: AdminBooking }>(`/admin/bookings/${id}`, { status }),

  reviews: () => get<{ success: true; data: AdminReview[] }>('/admin/reviews'),
  deleteReview: (id: string) => del<{ success: true }>(`/admin/reviews/${id}`),

  payouts: (status?: string) => get<{ success: true; data: AdminPayout[] }>(`/admin/payouts${status ? `?status=${status}` : ''}`),
  retryPayout: (id: string) => post<{ success: true; data: AdminPayout }>(`/admin/payouts/${id}/retry`),

  settings: () => get<{ success: true; data: SettingRow[] }>('/admin/settings'),
  updateSetting: (key: string, value: unknown) => put<{ success: true }>(`/admin/settings/${key}`, { value }),

  auditLog: () => get<{ success: true; data: AuditEntry[] }>('/admin/audit-log'),

  aiConversations: () => get<{ success: true; data: ChatConversationSummary[] }>('/admin/ai/conversations'),
  aiConversation: (sessionId: string) => get<{ success: true; data: ChatMessageRow[] }>(`/admin/ai/conversations/${sessionId}`),

  promoCodes: () => get<{ success: true; data: PromoCode[] }>('/admin/promo-codes'),
  createPromoCode: (data: { code: string; discountPercent?: number; discountFlat?: number; maxUses?: number; expiresAt?: string }) =>
    post<{ success: true; data: PromoCode }>('/admin/promo-codes', data),
  togglePromoCode: (code: string, active: boolean) => patch<{ success: true; data: PromoCode }>(`/admin/promo-codes/${code}`, { active }),
  deletePromoCode: (code: string) => del<{ success: true }>(`/admin/promo-codes/${code}`),
};

/* ── Fleet Financial Dashboard & Ledger ──────────────────────────────── */
export type FleetFilters = { carId?: string; platform?: string; category?: string; expenseType?: string; from?: string; to?: string };
function toQuery(params: Record<string, unknown>) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') usp.set(k, String(v)); });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

export const fleetApi = {
  summary: (f: FleetFilters = {}) => get<{ success: true; data: FleetSummary }>(`/fleet/summary${toQuery(f)}`),

  bookings: (f: FleetFilters = {}) => get<{ success: true; count: number; data: PlatformBookingEntry[] }>(`/fleet/bookings${toQuery(f)}`),
  addBooking: (data: { carId: string; platform: string; externalBookingId: string; bookedAt: string; totalFare: number; doorstepCharges?: number; platformCommission?: number; expectedCreditDate?: string }) =>
    post<{ success: true; data: PlatformBookingEntry }>('/fleet/bookings', data),
  markBookingReceived: (id: string) => patch<{ success: true; data: PlatformBookingEntry }>(`/fleet/bookings/${id}/received`),
  deleteBooking: (id: string) => del<{ success: true }>(`/fleet/bookings/${id}`),

  journalEntries: (f: FleetFilters = {}) => get<{ success: true; count: number; data: JournalEntryRow[] }>(`/fleet/journal-entries${toQuery(f)}`),
  addJournalEntry: (data: { carId: string; collectionDate: string; amountCollected: number; totalAmount: number; category: string; remarks?: string }) =>
    post<{ success: true; data: JournalEntryRow }>('/fleet/journal-entries', data),
  deleteJournalEntry: (id: string) => del<{ success: true }>(`/fleet/journal-entries/${id}`),

  expenses: (f: FleetFilters = {}) => get<{ success: true; count: number; data: FleetExpenseRow[] }>(`/fleet/expenses${toQuery(f)}`),
  addExpense: (data: { expenseType: string; carId?: string; paymentMode: string; paidTo?: string; amount: number; date: string; description?: string }) =>
    post<{ success: true; data: FleetExpenseRow }>('/fleet/expenses', data),
  deleteExpense: (id: string) => del<{ success: true }>(`/fleet/expenses/${id}`),
};

export interface AgentServiceRequest {
  id: string;
  serviceType: string;
  priceEstimate: number;
  scheduledDate: string;
  serviceLocation: string;
  status: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string | null;
  car: { make: string; model: string; registrationNo: string; city: string; images: string[] };
  requestedBy: { fullName: string; phoneNumber: string };
  booking?: { id: string; startTime: string; endTime: string } | null;
}

export const agentApi = {
  queue: () => get<{ success: true; count: number; data: AgentServiceRequest[] }>('/agent/service-requests'),
  updateStatus: (id: string, status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') =>
    patch<{ success: true; data: AgentServiceRequest }>(`/agent/service-requests/${id}`, { status }),
};

export interface OpsTripCheckInPayload {
  carId: string; tripCode?: string; bookingPlatform?: string; externalBookingId?: string; driverRef?: string;
  customerName: string; customerMobile: string; pickupLocation?: string; dropLocation?: string; pickupType?: string;
  startTime: string; odometerStart?: number; fastag?: string; baseFare?: number; addonTotal?: number; notes?: string;
}

export interface OpsTripCheckOutPayload {
  endTime?: string; odometerEnd?: number; checkoutFastag?: string; fuelEst?: string; carWashed?: boolean;
  washingCharges?: number; tyreHealth?: string; newDamages?: string; amountCollected?: number; amountPaidGuest?: number;
}

export const opsTripApi = {
  list: (params: { status?: string; carId?: string } = {}) =>
    get<{ success: true; count: number; data: OpsTripRow[] }>(`/ops-trips${toQuery(params)}`),
  get: (id: string) => get<{ success: true; data: OpsTripRow }>(`/ops-trips/${id}`),
  checkIn: (data: OpsTripCheckInPayload) => post<{ success: true; data: OpsTripRow }>('/ops-trips', data),
  checkOut: (id: string, data: OpsTripCheckOutPayload) => patch<{ success: true; data: OpsTripRow }>(`/ops-trips/${id}/checkout`, data),
  cancel: (id: string) => patch<{ success: true; data: OpsTripRow }>(`/ops-trips/${id}/cancel`),
};

export const financeApi = {
  commandCenter: (params: { from?: string; to?: string } = {}) =>
    get<{ success: true; data: CommandCenterData }>(`/finance/command-center${toQuery(params)}`),
  balanceSheet: (params: { asOf?: string } = {}) =>
    get<{ success: true; data: BalanceSheetData }>(`/finance/balance-sheet${toQuery(params)}`),

  outstandings: (params: { type?: string; status?: string } = {}) =>
    get<{ success: true; count: number; data: OutstandingRow[] }>(`/finance/outstandings${toQuery(params)}`),
  addOutstanding: (data: { expectedDate: string; paymentTo: string; amountOwed: number; outstandingType: OutstandingType; sourceType?: string; frequency?: OutstandingFrequency; recurringGroup?: string }) =>
    post<{ success: true; data: OutstandingRow }>('/finance/outstandings', data),
  settleOutstanding: (id: string) => patch<{ success: true; data: OutstandingRow }>(`/finance/outstandings/${id}/settle`),
  deleteOutstanding: (id: string) => del<{ success: true }>(`/finance/outstandings/${id}`),

  monthlyBalances: () => get<{ success: true; count: number; data: MonthlyBalanceRow[] }>('/finance/monthly-balances'),
  setMonthlyBalance: (month: string, data: { openingBalance: number; closingBalance?: number }) =>
    put<{ success: true; data: MonthlyBalanceRow }>(`/finance/monthly-balances/${month}`, data),
};
