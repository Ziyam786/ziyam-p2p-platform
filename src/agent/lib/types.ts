export type Role =
  | 'CUSTOMER' | 'SELF_HOST' | 'FLEET_OPERATOR' | 'AGENT'
  | 'FLEET_ADMIN' | 'OPERATIONS_EXECUTIVE' | 'MECHANICAL_EXECUTIVE' | 'TECHNICIAN'
  | 'ADMIN';

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isKycVerified: boolean;
  createdAt: string;
}

export interface AgentCar {
  id: string;
  make: string;
  model: string;
  registrationNo: string;
  city: string;
  images: string[];
  dailyRate: number;
  securityDeposit: number;
  kmIncludedPerDay: number;
  extraKmCharge: number;
}

export type OpsTripStatus = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

export type IdVerificationMethod = 'MASKED_PHOTO' | 'DIGILOCKER';
export type DepositPaymentMode = 'CASH' | 'ONLINE';

export interface AddonLine {
  type: string; // Washing | Damages | Fine / Penalty | Extra Helmet | Extra KMs | Toll | Waiting Charges | other
  amount: number;
  note?: string;
}

export interface OpsTripRow {
  id: string;
  tripCode?: string | null;
  carId: string;
  car?: { make: string; model: string; registrationNo: string; images: string[] };
  bookingPlatform?: string | null;
  pickupLocation?: string | null;
  dropLocation?: string | null;

  customerName: string;
  customerMobile: string;

  startTime: string;
  endTime?: string | null;
  odometerStart?: number | null;
  odometerEnd?: number | null;
  rangeKm?: number | null;

  baseFare?: number | null;
  addonTotal?: number | null;
  amount?: number | null;
  amountCollected?: number | null;
  amountPaidGuest?: number | null;
  addons?: AddonLine[] | null;
  checkoutAddons?: AddonLine[] | null;

  carWashed?: boolean;
  washingCharges?: number | null;
  tyreHealth?: string | null;
  newDamages?: string | null;

  status: OpsTripStatus;
  notes?: string | null;

  assignedAgentId?: string | null;
  agent?: { fullName: string } | null;

  idVerificationMethod?: IdVerificationMethod | null;
  maskedIdPhotoUrl?: string | null;
  dlFrontUrl?: string | null;
  dlBackUrl?: string | null;
  dlNumber?: string | null;
  digilockerStatus?: string | null;
  digilockerVerifiedName?: string | null;
  digilockerAddress?: string | null;
  saveIdentityToVault?: boolean;

  customerSignatureUrl?: string | null;
  vehiclePhotoUrls?: string[];
  customerDecision?: string | null;

  depositAmount?: number | null;
  depositCollected?: number | null;
  depositPaymentMode?: DepositPaymentMode | null;
  depositRefundedAt?: string | null;

  createdAt: string;
}

export interface CustomerVaultEntry {
  phoneNumber: string;
  fullName?: string | null;
  idVerificationMethod?: IdVerificationMethod | null;
  maskedIdPhotoUrl?: string | null;
  dlFrontUrl?: string | null;
  dlBackUrl?: string | null;
  dlNumber?: string | null;
  digilockerVerifiedName?: string | null;
  digilockerAddress?: string | null;
}

export type CashLogType = 'CASH_IN' | 'CASH_OUT';

export interface CashLogEntry {
  id: string;
  type: CashLogType;
  amount: number;
  category: string;
  note?: string | null;
  tripId?: string | null;
  trip?: { customerName: string; car: { make: string; model: string; registrationNo: string } } | null;
  createdAt: string;
}

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
}
