export type Role =
  | 'CUSTOMER' | 'SELF_HOST' | 'FLEET_OPERATOR' | 'AGENT'
  | 'FLEET_ADMIN' | 'OPERATIONS_EXECUTIVE' | 'MECHANICAL_EXECUTIVE' | 'TECHNICIAN'
  | 'ADMIN';
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
  kycDocUrl?: string | null;
  aadhaarVerifiedName?: string | null;
  digilockerStatus?: string | null;
  customRoleId?: string | null;
  customRole?: { name: string } | null;
  createdAt: string;
}

export const PERMISSION_KEYS = ['dashboard', 'earnings', 'collections', 'expenses', 'outstandings', 'balanceSheet', 'plStatement', 'config', 'roles'] as const;
export type PermissionKey = typeof PERMISSION_KEYS[number];

export interface CustomRoleRow {
  id: string;
  name: string;
  description?: string | null;
  permissions: Record<PermissionKey, boolean>;
  _count?: { users: number };
  createdAt: string;
  updatedAt: string;
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
  fuelType: string;
  transmission: string;
  seats: number;
  city: string;
  address?: string | null;
  dailyRate: number;
  securityDeposit: number;
  kmIncludedPerDay: number;
  extraKmCharge: number;
  description?: string | null;
  features: string[];
  isAvailable: boolean;
  featured: boolean;
  instantBook: boolean;
  offersDelivery: boolean;
  deliveryFee: number;
  offersPickup: boolean;
  pickupFee: number;
  fleetStatus?: string;
  pauseReason?: string | null;
  currentOdo?: number | null;
  fleetManaged: boolean;
  fleetOnboardingStep: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rcDocUrl?: string | null;
  pollutionCertUrl?: string | null;
  insuranceDocUrl?: string | null;
  rcExpiry?: string | null;
  insuranceExpiry?: string | null;
  pucExpiry?: string | null;
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
  hidden: boolean;
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
// Admin-configurable lists now (fleet_platforms/fleet_ledger_categories/
// fleet_expense_types/fleet_payment_modes Settings), not fixed enums — plain
// string aliases kept only so call sites read clearly.
export type RentalPlatform = string;
export type LedgerCategory = string;
export type FleetExpenseType = string;
export type PaymentMode = string;

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
  received: boolean;
  expectedCreditDate?: string | null;
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
  paidTo?: string | null;
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

/* ── Fleet Ops trip lifecycle ─────────────────────────────────────────── */
export type OpsTripStatus = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

export interface OpsTripRow {
  id: string;
  tripCode?: string | null;
  carId: string;
  car?: { make: string; model: string; registrationNo: string; images: string[] };
  bookingPlatform?: string | null;
  externalBookingId?: string | null;
  driverRef?: string | null;
  customerName: string;
  customerMobile: string;
  pickupLocation?: string | null;
  dropLocation?: string | null;
  pickupType?: string | null;
  startTime: string;
  endTime?: string | null;
  odometerStart?: number | null;
  odometerEnd?: number | null;
  rangeKm?: number | null;
  fastag?: string | null;
  checkoutFastag?: string | null;
  fuelEst?: string | null;
  carWashed: boolean;
  washingCharges?: number | null;
  tyreHealth?: string | null;
  newDamages?: string | null;
  baseFare?: number | null;
  addonTotal?: number | null;
  amount?: number | null;
  amountCollected?: number | null;
  amountPaidGuest?: number | null;
  status: OpsTripStatus;
  notes?: string | null;
  createdBy?: { fullName: string };
  agent?: { fullName: string } | null;
  createdAt: string;
}

/* ── Financial ERP ────────────────────────────────────────────────────── */
export interface CommandCenterData {
  cashPosition: number;
  moneyIn: number;
  moneyOut: number;
  bottomLine: number;
  retainedEarnings: number;
  openingCapital: number;
  tripCount: number;
  collectionCount: number;
}

export interface BalanceSheetData {
  openingCapital: number;
  retainedEarnings: number;
  cash: number;
  receivables: number;
  payables: number;
  assets: number;
  liabilities: number;
  equity: number;
}

export type OutstandingType = 'RECEIVABLE' | 'PAYABLE';
export type OutstandingStatus = 'PENDING' | 'PAID';
export type OutstandingFrequency = 'ONCE' | 'EVERY_TRIP' | 'EVERY_MONTH' | 'EVERY_DUE' | 'EVERY_PAYMENT' | 'EVERY_COLLECTION';

export interface OutstandingRow {
  id: string;
  expectedDate: string;
  paymentTo: string;
  amountOwed: number;
  outstandingType: OutstandingType;
  sourceType?: string | null;
  frequency: OutstandingFrequency;
  recurringGroup?: string | null;
  status: OutstandingStatus;
  paidDate?: string | null;
  createdAt: string;
}

export interface MonthlyBalanceRow {
  month: string;
  openingBalance: number;
  closingBalance?: number | null;
  createdAt: string;
}

/* ── Invoicing (GST) ──────────────────────────────────────────────────── */
export type OpsInvoiceType = 'RENTAL' | 'SERVICE';
export type OpsInvoiceStatus = 'DRAFT' | 'PENDING' | 'SENT' | 'PAID';

export interface OpsInvoiceRow {
  id: string;
  invoiceNumber: string;
  type: OpsInvoiceType;
  tripId?: string | null;
  trip?: (OpsTripRow & { car: AdminCar }) | null;
  serviceId?: string | null;
  service?: { serviceType: string; car: AdminCar } | null;
  amount: number;
  serviceChargePct: number;
  serviceCharge: number;
  netToOwner: number;
  status: OpsInvoiceStatus;
  issuedAt: string;
  placeOfSupply?: string | null;
  gstRate?: number | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  customerName?: string | null;
  customerMobile?: string | null;
  payments: { id: string; amount: number; status: string }[];
  createdAt: string;
}
