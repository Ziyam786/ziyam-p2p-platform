export type Role = 'CUSTOMER' | 'SELF_HOST' | 'FLEET_OPERATOR' | 'ADMIN';
export type BookingStatus = 'PENDING' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type PayoutStatus = 'HELD_IN_ESCROW' | 'QUEUED_FOR_N1' | 'SETTLED' | 'FAILED';

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: Role;
  isKycVerified: boolean;
  isSuspended: boolean;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isKycVerified: boolean;
  createdAt: string;
}

export interface AdminCar {
  id: string;
  ownerId: string;
  owner?: { fullName: string; email: string };
  make: string;
  model: string;
  registrationNo: string;
  year: number;
  category: string;
  city: string;
  dailyRate: number;
  isAvailable: boolean;
  featured: boolean;
  instantBook: boolean;
  createdAt: string;
  _count?: { bookings: number; reviews: number };
}

export interface AdminBooking {
  id: string;
  carId: string;
  car?: { make: string; model: string; city: string };
  customerId: string;
  customer?: { fullName: string; email: string };
  startTime: string;
  endTime: string;
  totalAmount: number;
  platformFee: number;
  hostPayoutAmount: number;
  protectionPlan: string;
  status: BookingStatus;
  createdAt: string;
}

export interface AdminReview {
  id: string;
  bookingId: string;
  carId: string;
  car?: { make: string; model: string };
  authorId: string;
  author?: { fullName: string };
  rating: number;
  comment?: string | null;
  createdAt: string;
}

export interface AdminPayout {
  id: string;
  bookingId: string;
  hostId: string;
  host?: { fullName: string; email: string };
  grossAmount: number;
  ziyamCut: number;
  netPayout: number;
  status: PayoutStatus;
  scheduledFor: string;
  payoutTxnId?: string | null;
  createdAt: string;
}

export interface AdminStats {
  userCount: number;
  carCount: number;
  bookingCount: number;
  gmv: number;
  activeTrips: number;
  pendingKyc: number;
}

export interface AuditEntry {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

export interface TrustBadge { label: string; sub: string; }
export interface CategoryDef { label: string; icon: string; desc: string; }
export interface CityDef { name: string; emoji: string; }
export interface ProtectionPlanDef { value: string; label: string; ratePerDay: number; desc: string; }
export interface LongRentalDiscount { minDays: number; percent: number; }
export interface Testimonial { name: string; quote: string; rating: number; }

export interface PromoCode {
  code: string;
  discountPercent?: number | null;
  discountFlat?: number | null;
  maxUses?: number | null;
  usedCount: number;
  active: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
  isDefault: boolean;
}

export interface ChatConversationSummary {
  sessionId: string;
  messageCount: number;
  lastMessage: string;
  lastMessageAt: string;
  userId: string | null;
}

export interface ChatMessageRow {
  id: string;
  sessionId: string;
  userId: string | null;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

/* ── Fleet Financial Dashboard & Ledger System ───────────────────────── */
export type RentalPlatform = 'ZOOMCAR' | 'REVV' | 'BHARAT' | 'MARC8';
export type LedgerCategory = 'FASTAG' | 'FUEL' | 'INSTANCES' | 'WASHING' | 'DAMAGE';
export type FleetExpenseType = 'ROUTINE_MAINTENANCE' | 'INSURANCE_PREMIUMS' | 'STATE_PERMITS' | 'ROAD_TAX' | 'DRIVER_SALARIES' | 'GENERAL_ADMIN';
export type PaymentMode = 'CASH' | 'UPI' | 'CORPORATE_CARD' | 'FLEET_FUEL_CARD';

export interface PlatformBookingEntry {
  id: string;
  carId: string;
  car?: { make: string; model: string; registrationNo: string };
  platform: RentalPlatform;
  externalBookingId: string;
  bookedAt: string;
  totalFare: number;
  doorstepCharges: number;
  platformCommission?: number | null;
  createdAt: string;
}

export interface JournalEntryRow {
  id: string;
  carId: string;
  car?: { make: string; model: string; registrationNo: string };
  collectionDate: string;
  amountCollected: number;
  totalAmount: number;
  category: LedgerCategory;
  remarks?: string | null;
  createdAt: string;
}

export interface FleetExpenseRow {
  id: string;
  expenseType: FleetExpenseType;
  carId?: string | null;
  car?: { make: string; model: string; registrationNo: string } | null;
  paymentMode: PaymentMode;
  amount: number;
  date: string;
  description?: string | null;
  createdAt: string;
}

export interface FleetSummary {
  totalRevenue: number;
  totalCollected: number;
  totalExpenses: number;
  netPosition: number;
  revenueByPlatform: Record<string, number>;
  collectedByCategory: Record<string, number>;
  expensesByType: Record<string, number>;
  bookingCount: number;
  journalEntryCount: number;
  expenseCount: number;
}
