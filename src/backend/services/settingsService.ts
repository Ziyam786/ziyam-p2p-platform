import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

/** Keys exposed to the public (unauthenticated) settings endpoint for the renter site. */
const PUBLIC_KEYS = [
  'hero_title',
  'hero_subtitle',
  'trust_badges',
  'categories',
  'cities',
  'protection_plans',
  'commission_percentage',
  'long_rental_discounts',
  'testimonials',
  'company_info',
  'smart_pricing',
  'demand_pricing',
  'fuel_price_per_litre',
] as const;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  hero_title: 'Your car.\nYour rules.\nDrive your way.',
  hero_subtitle:
    'Rent verified self-drive cars from trusted hosts across India. No driver. No restrictions. Just open roads.',
  trust_badges: [
    { label: 'Arya.ai', sub: 'KYC Verified' },
    { label: 'Escrow-Held', sub: 'Security Deposits' },
    { label: 'N+1', sub: 'Guaranteed Payouts' },
    { label: 'Zero', sub: 'Hidden Fees' },
  ],
  categories: [
    { label: 'Hatchback', icon: '🚘', desc: 'Compact & affordable' },
    { label: 'Sedan', icon: '🚗', desc: 'Comfortable & stylish' },
    { label: 'SUV', icon: '🛻', desc: 'Space for the family' },
    { label: 'Luxury', icon: '🏎️', desc: 'Premium experience' },
    { label: 'EV', icon: '⚡', desc: 'Zero-emission trips' },
    { label: 'MUV', icon: '🚐', desc: 'Group travel' },
  ],
  cities: [
    { name: 'Bengaluru', emoji: '🏙️' },
  ],
  protection_plans: [
    { value: 'BASIC', label: 'Basic', ratePerDay: 0, desc: 'Standard deposit terms, included free.' },
    { value: 'STANDARD', label: 'Standard', ratePerDay: 149, desc: 'Reduced deposit hold + priority roadside assistance.' },
    { value: 'PREMIUM', label: 'Premium', ratePerDay: 349, desc: 'Lowest deposit hold + 24/7 priority support.' },
  ],
  // Smart pricing baseline — no comparable-listings dataset exists yet (too
  // few hosts to average against), so this admin-editable formula stands in
  // for "market value" until real listing data makes an average meaningful.
  // Hosts can't type a price; they scroll a slider capped between
  // marketHourlyRate*0.95 and marketHourlyRate (see SmartPriceSlider.tsx).
  smart_pricing: {
    categoryHourlyRates: {
      Hatchback: 50,
      Sedan: 65,
      SUV: 85,
      Luxury: 150,
      EV: 70,
      MUV: 90,
    },
    cityMultipliers: {
      Bengaluru: 1,
    },
    defaultCityMultiplier: 1,
  },
  long_rental_discounts: [
    { minDays: 3, percent: 0.05 },
    { minDays: 5, percent: 0.10 },
    { minDays: 10, percent: 0.15 },
  ],
  testimonials: [],
  company_info: {
    legalName: 'Eightlines Fleet Private Limited',
    brand: 'ZIYAM',
    brandFull: 'ZiyamSelfDrive',
    cin: 'U77100KA2026PTC7772',
    registeredDate: '16 March 2026',
    address: '8-Lines Fleet, 15th Cross Rd, Popular Colony, Mangammanapalya, Bengaluru, Karnataka 560068',
    email: 'eightlinesfleet@gmail.com',
    phone: '+91 63636 17864',
    whatsappUrl: 'https://wa.me/916363617864',
    operatingCity: 'Bengaluru',
    scopeNote: 'Currently operating in Bengaluru only — expanding pan-India as the fleet grows.',
    jurisdiction: 'Courts at Bengaluru, Karnataka',
    team: [
      {
        name: 'Syed Fardeen',
        role: 'Founder, CEO & Director',
        bio: 'Sets group strategy and capital allocation across Ziyam Self Drive, Mechanix Pro and Marc8. Owns fleet expansion, brand and long-term partnerships.',
      },
      {
        name: 'Mohammed Azam A',
        role: 'Co-Founder & Managing Director',
        bio: 'Leads business growth and expansion: hub network, partner and vendor relationships, and P&L accountability across the EFPL brands.',
      },
      {
        name: 'Shaik Afnan Sabil',
        role: 'Co-Founder & VP, Operations',
        bio: 'Owns fleet operations end to end: handover and return inspections, preventive maintenance cycles, hub parking protocols and agent performance.',
      },
      {
        name: 'Junaid Khan',
        role: 'Co-Founder & Chief Operating Officer',
        bio: 'Owns execution across the fleet: hub throughput, vehicle utilisation, service standards and delivery across Ziyam Self Drive and Mechanix Pro.',
      },
      {
        name: 'Numer Saqlain M',
        role: 'Co-Founder & Chief Financial Officer',
        bio: 'Owns finance across EFPL: host settlements and payout cycles, unit economics, GST and statutory compliance, and capital planning.',
      },
    ],
  },
  commission_percentage: config.payout.platformCommission,
  host_share_percentage: config.payout.hostShare,
  settlement_hours: config.payout.settlementHours,
  // How long a host has to Accept/Reject a paid booking before the
  // auto-reject cron steps in (see hostReview.routes.ts, payoutEngine.ts's
  // initializeHostReviewTimeoutCron). Admin-only, not in PUBLIC_KEYS.
  host_review_window_hours: 2,
  ai_chat_enabled: true,
  ai_chat_system_prompt:
    'You are the ZiyamSelfDrive support assistant, a peer-to-peer self-drive car rental platform currently operating ' +
    'in Bengaluru only. Hosts keep 70% of every booking (Ziyam keeps 30%). Self-hosted hosts are paid 24-48 hours ' +
    'after trip completion (or weekly, if they opt in); hosts managed by a fleet operator are paid within 1 day of ' +
    'the fleet operator confirming receipt from the platform. Lessees must be 21+ with a valid driving licence 1+ ' +
    'year old. Identity KYC is Aadhaar OTP eKYC or Arya.ai document check (plus DigiLocker where offered). Driving licence, liveness selfie, and host RC checks are via Arya.ai and are mandatory for both lessees and hosts. Security deposits are refundable ' +
    'and released after a clean return. Protection plans only affect deposit-hold amount and support priority — ' +
    'Basic (free), Standard (+₹149/day, reduced deposit hold), Premium (+₹349/day, lowest deposit hold). ZiyamSelfDrive ' +
    'does not insure vehicles against lessee-caused damage: every listed car carries the host\'s own comprehensive ' +
    'insurance, hosts recover damage costs directly from the lessee, and the platform helps by trying to cover up to ' +
    '₹20,000 of a claim and suggesting garages, with 24/7 roadside assistance for breakdowns or abandoned vehicles. ' +
    'Free cancellation up to 24 hours before pickup. Answer briefly and helpfully; if you do not know something ' +
    'platform-specific, suggest contacting eightlinesfleet@gmail.com.',

  // Fleet Ops facilitation fee — admin-only (not in PUBLIC_KEYS). Ground-truthed
  // from the real production system: one configurable percentage (not the
  // marketing doc's "18-28% dynamic" range), frozen onto each OpsInvoice at
  // creation time so later config changes don't retroactively alter
  // already-issued invoices. Default matches the real system's default.
  fleet_facilitation_fee_pct: 20,

  // Admin-configurable lookup lists (all admin-only, not in PUBLIC_KEYS) —
  // replace what used to be fixed Postgres enums on PlatformBooking/
  // JournalEntry/FleetExpense. Defaults below are exactly the original enum
  // values, so nothing changes for existing usage until an admin edits them.
  fleet_platforms: ['ZOOMCAR', 'REVV', 'BHARAT', 'MARC8'],
  fleet_ledger_categories: ['FASTAG', 'FUEL', 'INSTANCES', 'WASHING', 'DAMAGE'],
  fleet_expense_types: ['ROUTINE_MAINTENANCE', 'INSURANCE_PREMIUMS', 'STATE_PERMITS', 'ROAD_TAX', 'DRIVER_SALARIES', 'GENERAL_ADMIN'],
  fleet_payment_modes: ['CASH', 'UPI', 'CORPORATE_CARD', 'FLEET_FUEL_CARD'],

  // Demand-based dynamic pricing — additive "bumps" on top of the base
  // category+city market rate (see SmartPriceSlider / smart_pricing above),
  // stacked and capped at maxMultiplier. Keyed off the trip's pickup time.
  // Renter-facing (affects what a booking costs), unlike smart_pricing which
  // is host-facing (affects what a host is allowed to list at) — the two are
  // deliberately separate: a host's listed rate is a stable reference price,
  // not something that should silently change trip-to-trip.
  demand_pricing: {
    weekendBump: 0.15, // Fri 6pm - Sun 11:59pm
    peakHourBump: 0.10,
    peakHours: [[7, 10], [17, 21]] as [number, number][], // 7-10am, 5-9pm
    holidayBump: 0.25,
    maxMultiplier: 1.5,
    // 2026 Indian public holidays (admin-editable — extend/replace per year)
    publicHolidays: [
      '2026-01-01', '2026-01-14', '2026-01-26', '2026-03-04', '2026-03-21',
      '2026-04-03', '2026-04-14', '2026-05-01', '2026-08-15', '2026-08-28',
      '2026-10-02', '2026-10-20', '2026-11-08', '2026-12-25',
    ],
  },

  // Road-trip planner's fuel-cost estimate (src/backend/routes/plan.routes.ts
  // consumers on the frontend). A rough, admin-tunable average pump price —
  // not tied to any real-time fuel-price feed.
  fuel_price_per_litre: 105,

  // GST invoicing. GSTIN is real, confirmed against the actual GST REG-06
  // registration certificate (Form GST REG-06, effective 27/06/2026,
  // Bengaluru Urban, Karnataka — Regular registration). gst_rate is still a
  // placeholder — the certificate confirms registration but not which rate
  // scheme applies to this specific rent-a-cab structure; confirm with a tax
  // advisor before relying on invoices for filing.
  company_gstin: '29AAJCE5740K1Z7',
  company_home_state: 'Karnataka',
  default_gst_rate: 0.05, // PLACEHOLDER — confirm actual applicable rate before relying on this for filing

  // Financial ERP Command Center — admin-only. Starting cash injection the
  // cumulative cash-position/balance-sheet math builds on top of (see
  // financeErp.routes.ts, ground-truthed formulas from the real ERP).
  finance_opening_capital: 0,
};

export async function getSetting<T = unknown>(key: string, fallback?: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (row) return row.value as T;
  if (fallback !== undefined) return fallback;
  return DEFAULT_SETTINGS[key] as T;
}

export async function setSetting(key: string, value: unknown) {
  return prisma.setting.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });
}

export async function getAllSettings() {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const keys = new Set([...Object.keys(DEFAULT_SETTINGS), ...map.keys()]);
  return Array.from(keys).map((key) => ({
    key,
    value: map.has(key) ? map.get(key) : DEFAULT_SETTINGS[key],
    isDefault: !map.has(key),
  }));
}

export async function getPublicSettings() {
  const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS as unknown as string[] } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, unknown> = {};
  for (const key of PUBLIC_KEYS) {
    result[key] = map.has(key) ? map.get(key) : DEFAULT_SETTINGS[key];
  }
  return result;
}
