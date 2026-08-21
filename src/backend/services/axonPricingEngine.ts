export interface FareCalculationInput {
  dailyRate: number;
  pickupTime: Date;
  dropTime: Date;
  isWeekend?: boolean;
  platformFeeFixed?: number;
  fastagDepositFixed?: number;
  gstRate?: number; // default 0.05 (5% GST)
}

export interface FareBreakdown {
  durationDays: number;
  durationHours: number;
  baseFare: number;
  surgeMultiplier: number;
  platformFee: number;
  fastagDeposit: number;
  subtotal: number;
  gstAmount: number;
  totalPayable: number;
}

export class AxonPricingEngine {
  private static readonly DEFAULT_PLATFORM_FEE = 250;
  private static readonly DEFAULT_FASTAG_DEPOSIT = 500;
  private static readonly DEFAULT_GST_RATE = 0.05;

  /**
   * Computes granular trip fare with zero hidden fees
   */
  public static calculateFare(input: FareCalculationInput): FareBreakdown {
    const diffMs = input.dropTime.getTime() - input.pickupTime.getTime();
    if (diffMs <= 0) {
      throw new Error('Drop time must be strictly after pickup time');
    }

    const durationHours = Math.ceil(diffMs / (1000 * 60 * 60));
    // Charge in full 24-hour day chunks, with a minimum of 1 day
    const durationDays = Math.max(1, Math.ceil(durationHours / 24));

    // Dynamic weekend surge multiplier (1.15x for Fri-Sun)
    const isWeekend = input.isWeekend ?? this.isWeekendRental(input.pickupTime);
    const surgeMultiplier = isWeekend ? 1.15 : 1.0;

    const baseFare = Math.round(input.dailyRate * durationDays * surgeMultiplier);
    const platformFee = input.platformFeeFixed ?? this.DEFAULT_PLATFORM_FEE;
    const fastagDeposit = input.fastagDepositFixed ?? this.DEFAULT_FASTAG_DEPOSIT;

    const taxableAmount = baseFare + platformFee;
    const gstRate = input.gstRate ?? this.DEFAULT_GST_RATE;
    const gstAmount = Math.round(taxableAmount * gstRate);

    // Total includes refundable FASTag deposit
    const totalPayable = taxableAmount + gstAmount + fastagDeposit;

    return {
      durationDays,
      durationHours,
      baseFare,
      surgeMultiplier,
      platformFee,
      fastagDeposit,
      subtotal: taxableAmount,
      gstAmount,
      totalPayable,
    };
  }

  private static isWeekendRental(pickup: Date): boolean {
    const day = pickup.getDay();
    return day === 5 || day === 6 || day === 0; // Friday, Saturday, Sunday
  }
}