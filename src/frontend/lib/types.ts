export type Role = 'CUSTOMER' | 'SELF_HOST' | 'FLEET_OPERATOR' | 'ADMIN';

export type BookingStatus = 'PENDING' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type PayoutStatus = 'HELD_IN_ESCROW' | 'QUEUED_FOR_N1' | 'SETTLED' | 'FAILED';

export type ProtectionPlan = 'BASIC' | 'STANDARD' | 'PREMIUM';

export type CarVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: Role;
  isKycVerified: boolean;
  isSuspended?: boolean;
  avatarUrl?: string | null;
  bio?: string | null;
  payoutAccountId?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankNameAtBank?: string | null;
  bankAccountVerified?: boolean;
  signatureUrl?: string | null;
  selfieUrl?: string | null;
  alternatePhoneNumber?: string | null;
  referralCode?: string | null;
  creditsBalance?: number;
  payoutFrequency?: 'STANDARD' | 'WEEKLY';
  createdAt: string;
}

export interface Car {
  id: string;
  ownerId: string;
  owner?: { id?: string; fullName: string; avatarUrl?: string | null; bio?: string | null; createdAt?: string; signatureUrl?: string | null };
  make: string;
  model: string;
  registrationNo: string;
  year: number;
  category: string;
  fuelType: string;
  transmission: string;
  seats: number;
  dailyRate: number;
  securityDeposit: number;
  kmIncludedPerDay: number;
  extraKmCharge: number;
  description?: string | null;
  images: string[];
  features: string[];
  city: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isAvailable: boolean;
  instantBook: boolean;
  featured: boolean;
  offersDelivery: boolean;
  deliveryFee: number;
  offersPickup: boolean;
  pickupFee: number;
  rating: number;
  reviewCount: number;
  createdAt: string;

  verificationStatus: CarVerificationStatus;
  rcDocUrl?: string | null;
  pollutionCertUrl?: string | null;
  insuranceDocUrl?: string | null;
  onboardingStep: number;

  noNightBookings: boolean;
  nightBookingStart: string;
  nightBookingEnd: string;
  minInterBookingHours: number;
  minBookingHours: number;
  maxBookingDays: number;

  fleetManaged: boolean;
  fleetOperatorId?: string | null;
}

export interface Booking {
  id: string;
  carId: string;
  car?: Car;
  customerId: string;
  customer?: { id?: string; fullName: string; email: string; signatureUrl?: string | null };
  startTime: string;
  endTime: string;
  totalAmount: number;
  platformFee: number;
  hostPayoutAmount: number;
  protectionPlan: ProtectionPlan;
  deliveryRequested: boolean;
  promoCode?: string | null;
  status: BookingStatus;
  paymentIntentId?: string | null;
  review?: Review | null;
  esignRequestId?: string | null;
  esignStatus?: string | null;
  esignDownloadUrl?: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  carId: string;
  authorId: string;
  author?: { fullName: string; avatarUrl?: string | null };
  targetHostId: string;
  car?: { make: string; model: string };
  rating: number;
  comment?: string | null;
  createdAt: string;
}

export interface EarningsOverview {
  totalGross: number;
  ziyamCut: number;
  netEarnings: number;
  pendingEscrow: number;
  settledPayouts: number;
}

export interface UtilizationEntry {
  carId: string;
  label: string;
  utilizationPercent: number;
}

export interface IncentiveTarget {
  met: boolean;
  current: number;
  target: number;
  unit: string;
  currentDays?: number;
  targetDays?: number;
}

export interface IncentiveProgress {
  month: string;
  daysRemaining: number;
  daysElapsedThisMonth: number;
  allMet: boolean;
  bonusPercent: number;
  targets: {
    fulfillment: IncentiveTarget;
    listingDays: IncentiveTarget;
    rating: IncentiveTarget;
    bookings: IncentiveTarget;
  };
}

export interface TrustBadge { label: string; sub: string; }
export interface CategoryDef { label: string; icon: string; desc: string; }
export interface CityDef { name: string; emoji: string; }
export interface ProtectionPlanDef { value: ProtectionPlan; label: string; ratePerDay: number; desc: string; }
export interface LongRentalDiscount { minDays: number; percent: number; }
export interface Testimonial { name: string; quote: string; rating: number; }

export interface CompanyInfo {
  legalName: string; brand: string; brandFull: string; cin: string; registeredDate: string;
  address: string; email: string; phone: string; whatsappUrl: string; operatingCity: string;
  scopeNote: string; jurisdiction: string; team: { name: string; role: string }[];
}

export interface PublicSettings {
  hero_title: string;
  hero_subtitle: string;
  trust_badges: TrustBadge[];
  categories: CategoryDef[];
  cities: CityDef[];
  protection_plans: ProtectionPlanDef[];
  commission_percentage: number;
  long_rental_discounts: LongRentalDiscount[];
  testimonials: Testimonial[];
  company_info: CompanyInfo;
}

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

export type ServiceRequestStatus = 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface ServiceCatalogEntry {
  serviceType: string;
  description: string;
  priceFrom: number;
}

export interface ServiceRequest {
  id: string;
  carId: string;
  serviceType: string;
  priceEstimate: number;
  scheduledDate: string;
  serviceLocation: string;
  status: ServiceRequestStatus;
  notes?: string | null;
  fleetExpenseId?: string | null;
  createdAt: string;
}

export interface Blackout {
  id: string;
  carId: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  createdAt: string;
}

export type NotificationType =
  | 'BOOKING_CONFIRMED' | 'TRIP_STARTED' | 'REVIEW_RECEIVED' | 'KYC_VERIFIED' | 'PAYOUT_SETTLED' | 'PROMO' | 'GENERIC';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
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
