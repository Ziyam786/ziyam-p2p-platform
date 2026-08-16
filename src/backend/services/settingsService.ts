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
] as const;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  hero_title: 'Your car.\nYour rules.\nDrive your way.',
  hero_subtitle:
    'Rent verified self-drive cars from trusted hosts across India. No driver. No restrictions. Just open roads.',
  trust_badges: [
    { label: '1 Lakh+', sub: 'Happy Renters' },
    { label: '5,000+', sub: 'Verified Cars' },
    { label: '30+ Cities', sub: 'Pan-India' },
    { label: '4.6 ★', sub: 'Average Rating' },
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
    { name: 'Mumbai', emoji: '🌊' },
    { name: 'Delhi NCR', emoji: '🕌' },
    { name: 'Hyderabad', emoji: '🏯' },
    { name: 'Chennai', emoji: '🎭' },
    { name: 'Pune', emoji: '🎓' },
  ],
  protection_plans: [
    { value: 'BASIC', label: 'Basic', ratePerDay: 0, desc: 'Standard third-party coverage, included free.' },
    { value: 'STANDARD', label: 'Standard', ratePerDay: 149, desc: 'Reduced liability + roadside assistance.' },
    { value: 'PREMIUM', label: 'Premium', ratePerDay: 349, desc: 'Zero liability on damage + 24/7 priority support.' },
  ],
  long_rental_discounts: [
    { minDays: 3, percent: 0.05 },
    { minDays: 5, percent: 0.10 },
    { minDays: 10, percent: 0.15 },
  ],
  testimonials: [
    { name: 'Ananya R.', quote: 'Booked a Creta for a weekend trip to Coorg — spotless car, host was super responsive. Way cheaper than the usual rental chains.', rating: 5 },
    { name: 'Vikram S.', quote: "I've listed my Swift on Ziyam for 8 months now. The N+1 payouts land like clockwork and support actually picks up the phone.", rating: 5 },
    { name: 'Fatima K.', quote: 'KYC took two minutes, car was delivered to my apartment. Didn\'t expect that level of convenience from a P2P platform.', rating: 4 },
  ],
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
      { name: 'Numer Saqlain M', role: 'Co-founder' },
      { name: 'Mohammed Azam A', role: 'Co-founder' },
      { name: 'Shaik Afnan Sabil', role: 'Fleet General Managing Director' },
    ],
  },
  commission_percentage: config.payout.platformCommission,
  host_share_percentage: config.payout.hostShare,
  settlement_hours: config.payout.settlementHours,
  ai_chat_enabled: true,
  ai_chat_system_prompt:
    'You are the ZiyamSelfDrive support assistant, a peer-to-peer self-drive car rental platform in India. ' +
    'Hosts keep 70% of every booking (Ziyam keeps 30%). Payouts settle on an N+1 schedule after trip completion. ' +
    'Renters must be 21+ with a valid driving licence 1+ year old. KYC is via DigiLocker. Security deposits are ' +
    'refundable and released after a clean return. Protection plans: Basic (free), Standard (+₹149/day, reduced ' +
    'liability), Premium (+₹349/day, zero liability). Free cancellation up to 24 hours before pickup. Answer ' +
    'briefly and helpfully; if you do not know something platform-specific, suggest contacting support@ziyam.in.',
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
