export type Role =
  | 'CUSTOMER' | 'SELF_HOST' | 'FLEET_OPERATOR' | 'AGENT'
  | 'FLEET_ADMIN' | 'OPERATIONS_EXECUTIVE' | 'MECHANICAL_EXECUTIVE' | 'TECHNICIAN'
  | 'ADMIN';

export type BookingStatus =
  | 'PENDING' | 'PENDING_PAYMENT' | 'PENDING_HOST_REVIEW' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED'
  | 'CANCELLED' | 'REJECTED';

export type PayoutStatus = 'HELD_IN_ESCROW' | 'QUEUED_FOR_N1' | 'SETTLED' | 'FAILED';

export type ProtectionPlan = 'BASIC' | 'STANDARD' | 'PREMIUM';
export type BookingDepositStatus = 'HELD' | 'RELEASED' | 'PARTIALLY_DEDUCTED' | 'FORFEITED';
export type DamageClaimStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
export type CancelledBy = 'CUSTOMER' | 'HOST' | 'SYSTEM' | 'ADMIN';
export type TripStage = 'PRE_TRIP' | 'POST_TRIP';
export type PhotoAngle = 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT' | 'MIRROR_LEFT' | 'MIRROR_RIGHT' | 'ODOMETER' | 'OTHER';

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
  partnerAgreementWetSignedUrl?: string | null;
  partnerAgreementWetSignedAt?: string | null;
  partnerAgreementEsignStatus?: string | null;
  partnerAgreementEsignDownloadUrl?: string | null;
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
  // Admin-only unblurred originals, same array index as `images` — never
  // rendered by any customer-facing page/component (see PlateBlurEditor.tsx).
  originalImages?: string[];
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
  fleetOperator?: { fullName: string; phoneNumber: string; email: string } | null;
  fleetOnboardingStep: number;

  chassis?: string | null;
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
  coDriverRequested?: boolean;
  coDriverName?: string | null;
  coDriverLicenseNumber?: string | null;
  promoCode?: string | null;
  status: BookingStatus;
  paymentIntentId?: string | null;
  review?: Review | null;
  esignRequestId?: string | null;
  esignStatus?: string | null;
  esignDownloadUrl?: string | null;
  depositAmount: number;
  depositStatus: BookingDepositStatus;
  depositReleasedAt?: string | null;
  damageClaim?: DamageClaim | null;
  hostReviewDeadline?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: CancelledBy | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  deliveryLocationUpdatedAt?: string | null;
  createdAt: string;
}

export interface DeliveryLocation {
  latitude: number;
  longitude: number;
  updatedAt: string;
  source: 'TELEMATICS' | 'HOST_APP';
}

export interface BookingConditionPhoto {
  id: string;
  bookingId: string;
  stage: TripStage;
  angle: PhotoAngle;
  url: string;
  uploadedById: string;
  createdAt: string;
}

export interface DamageClaim {
  id: string;
  bookingId: string;
  reportedById: string;
  description: string;
  images: string[];
  estimatedCost: number;
  status: DamageClaimStatus;
  approvedDeduction?: number | null;
  adminNotes?: string | null;
  reviewedByAdminId?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
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

export interface SmartPricing {
  categoryHourlyRates: Record<string, number>;
  cityMultipliers: Record<string, number>;
  defaultCityMultiplier: number;
}

export interface DemandPricing {
  weekendBump: number;
  peakHourBump: number;
  peakHours: [number, number][];
  holidayBump: number;
  maxMultiplier: number;
  publicHolidays: string[];
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
  smart_pricing: SmartPricing;
  demand_pricing: DemandPricing;
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
