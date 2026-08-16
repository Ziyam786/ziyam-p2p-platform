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
] as const;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  hero_title: 'Your car.\nYour rules.\nDrive your way.',
  hero_subtitle:
    'Rent verified self-drive cars from trusted hosts across India. No driver. No restrictions. Just open roads.',
  trust_badges: [
    { label: 'DigiLocker', sub: 'KYC Verified' },
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
    cin: 'U77100KA2026PTC21777',
    registeredDate: '16 March 2026',
    address: '8-Lines Fleet, 15th Cross Rd, Popular Colony, Mangammanapalya, Bengaluru, Karnataka 560068',
    email: 'eightlinesfleet@gmail.com',
    phone: '+91 63636 17864',
    whatsappUrl: 'https://wa.me/916363617864',
    operatingCity: 'Bengaluru',
    scopeNote: 'Currently operating in Bengaluru only — expanding pan-India as the fleet grows.',
    jurisdiction: 'Courts at Bengaluru, Karnataka',
    team: [
      { name: 'Syed Fardeen', role: 'Founder & Director' },
      { name: 'Junaid Khan', role: 'Co-founder & Director' },
      { name: 'Numer Saqlain M', role: 'Co-founder & Director' },
      { name: 'Mohammed Azam A', role: 'Co-founder & Managing Director' },
      { name: 'Shaik Afnan Sabil', role: 'Co-founder & VP Operations' },
    ],
  },
  commission_percentage: config.payout.platformCommission,
  host_share_percentage: config.payout.hostShare,
  settlement_hours: config.payout.settlementHours,
  ai_chat_enabled: true,
  ai_chat_system_prompt:
    'You are the ZiyamSelfDrive support assistant, a peer-to-peer self-drive car rental platform currently operating ' +
    'in Bengaluru only. Hosts keep 70% of every booking (Ziyam keeps 30%). Self-hosted hosts are paid 24-48 hours ' +
    'after trip completion (or weekly, if they opt in); hosts managed by a fleet operator are paid within 1 day of ' +
    'the fleet operator confirming receipt from the platform. Renters must be 21+ with a valid driving licence 1+ ' +
    'year old. KYC is via DigiLocker and is mandatory for both renters and hosts. Security deposits are refundable ' +
    'and released after a clean return. Protection plans only affect deposit-hold amount and support priority — ' +
    'Basic (free), Standard (+₹149/day, reduced deposit hold), Premium (+₹349/day, lowest deposit hold). ZiyamSelfDrive ' +
    'does not insure vehicles against renter-caused damage: every listed car carries the host\'s own comprehensive ' +
    'insurance, hosts recover damage costs directly from the renter, and the platform helps by trying to cover up to ' +
    '₹20,000 of a claim and suggesting garages, with 24/7 roadside assistance for breakdowns or abandoned vehicles. ' +
    'Free cancellation up to 24 hours before pickup. Answer briefly and helpfully; if you do not know something ' +
    'platform-specific, suggest contacting support@ziyam.in.',

  // Fleet Ops facilitation fee — admin-only (not in PUBLIC_KEYS). Ground-truthed
  // from the real production system: one configurable percentage (not the
  // marketing doc's "18-28% dynamic" range), frozen onto each OpsInvoice at
  // creation time so later config changes don't retroactively alter
  // already-issued invoices. Default matches the real system's default.
  fleet_facilitation_fee_pct: 20,
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
  const result: Record<string, unknown> = {};
  for (const key of PUBLIC_KEYS) {
    result[key] = await getSetting(key);
  }
  return result;
}
