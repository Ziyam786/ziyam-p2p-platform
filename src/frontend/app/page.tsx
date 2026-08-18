'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  Search, ShieldCheck, Wallet, TrendingUp, FileCheck, CreditCard, Key, Sparkles,
  ChevronRight, Star, Clock, MessageCircle, Mountain, ArrowRight, ArrowUpRight,
  Users, BadgeCheck, Radio, Camera, Building2, Mail, Route,
  IndianRupee, CalendarClock, MapPin, CheckCircle2, SlidersHorizontal, Award,
  CarFront, Gem, BatteryCharging, Settings2, Coffee, Waves, TreePine,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SearchBar from '../components/SearchBar';
import CarCard from '../components/CarCard';
import { CarCardSkeleton } from '../components/Skeleton';
import ScrollReveal, { StaggerGroup, StaggerItem } from '../components/ScrollReveal';
import MotionButton from '../components/MotionButton';
import TiltCard from '../components/TiltCard';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { carsApi, settingsApi, itinerariesApi, ApiError } from '../lib/api';
import type { ItineraryDestination } from '../lib/api';
import { COMPANY } from '../lib/companyInfo';
import { setStickyDates } from '../lib/searchDates';
import type { Car, CategoryDef, CityDef, Testimonial, TrustBadge } from '../lib/types';

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Illustrative fleet imagery ──────────────────────────────────────
   Same aeplcdn.com URLs already used in prisma/seed.ts's CAR_IMAGES map,
   reused here verbatim (not new/unverified URLs) for the category-showcase
   visuals. These represent vehicle categories generally — actual live
   inventory is dynamic and city-scoped via carsApi.list()/marketPulse(),
   fetched separately below. */
type ShowcaseKey = 'offroad' | 'suv' | 'family';
const SHOWCASE: Record<ShowcaseKey, { image: string; label: string; caption: string }> = {
  offroad: {
    image: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/141301/thar-exterior-right-front-three-quarter-2.jpeg', // Mahindra Thar
    label: 'Off-Road',
    caption: 'SUV & off-road category',
  },
  suv: {
    image: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/141301/seltos-exterior-right-front-three-quarter.jpeg', // Kia Seltos
    label: 'SUV',
    caption: 'Everyday SUV category',
  },
  family: {
    image: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/40087/innova-crysta-exterior-right-front-three-quarter-5.jpeg', // Toyota Innova Crysta
    label: '7-Seater',
    caption: '7-seater family category',
  },
};

const HERO_TITLE_FALLBACK = 'Experience Mobility.\nDrive or Earn.';
const HERO_SUBTITLE_FALLBACK =
  'Rent verified self-drive cars from trusted Bengaluru hosts, or list your own and turn it into passive income — one platform, zero hidden fees.';

const TRUST_BADGES_FALLBACK: TrustBadge[] = [
  { label: 'Arya.ai', sub: 'KYC Verified' },
  { label: 'Escrow-Held', sub: 'Security Deposits' },
  { label: 'N+1', sub: 'Guaranteed Payouts' },
  { label: 'Zero', sub: 'Hidden Fees' },
];

const CATEGORIES_FALLBACK: CategoryDef[] = [
  { label: 'Hatchback', icon: '🚘', desc: 'Compact & affordable' },
  { label: 'Sedan', icon: '🚗', desc: 'Comfortable & stylish' },
  { label: 'SUV', icon: '🛻', desc: 'Space for the family' },
  { label: 'Luxury', icon: '🏎️', desc: 'Premium experience' },
  { label: 'EV', icon: '⚡', desc: 'Zero-emission trips' },
  { label: 'MUV', icon: '🚐', desc: 'Group travel' },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Hatchback: CarFront,
  Sedan: CarFront,
  SUV: Mountain,
  Luxury: Gem,
  EV: BatteryCharging,
  MUV: Users,
};

const CITIES_FALLBACK: CityDef[] = [{ name: 'Bengaluru', emoji: '🏙️' }];

const TESTIMONIALS_FALLBACK: Testimonial[] = [];

const HOW_STEPS = [
  { icon: Search, title: 'Search & Filter', desc: 'Choose your city, dates, and preferred car category. We show real-time availability.' },
  { icon: FileCheck, title: 'Instant KYC', desc: 'Aadhaar OTP or upload your ID, then your driving licence. Arya.ai verifies licence photos, liveness, and face match.' },
  { icon: CreditCard, title: 'Pay Securely', desc: 'Pay via UPI, card, or wallet. Security deposit held in escrow — released at trip end.' },
  { icon: Key, title: 'Drive Free', desc: 'Pick up the car at the host location. Drive wherever you want — you are in control.' },
];

/* ── Bengaluru hub options for the fare estimator — illustrative pickup
   points, not a live-filterable backend field (Car model has no per-hub
   granularity today, only city/address/lat-long). */
const HUBS = ['Mangammanapalya HQ', 'HSR Layout', 'Koramangala', 'Airport Doorstep'];

/* Representative daily rate used only when live market-pulse data hasn't
   loaded yet — replaced instantly by carsApi.marketPulse()'s real
   averageDailyRate once it resolves. Mirrors the seed catalog's mid-range. */
const FALLBACK_DAILY_RATE = 2199;

/* Real 8% customer-facing platform fee — matches the exact rate already
   charged at actual checkout (src/frontend/app/cars/[id]/page.tsx:
   `platformFee = Math.round(preFeeSubtotal * 0.08)`), so this homepage
   estimate never shows a number the real booking flow wouldn't also show. */
const PLATFORM_FEE_RATE = 0.08;
const FASTAG_PASS_COST = 99;

/* Host earnings calculator teaser — identical formula to the full
   /host/earnings-calculator page (HOST_SHARE = 0.7) so the two never
   disagree on a number. */
const HOST_SHARE = 0.7;

type FleetFilter = 'ALL' | 'OFFROAD' | 'LUXURY7' | 'AUTO';
const FLEET_FILTERS: { key: FleetFilter; label: string; icon: LucideIcon }[] = [
  { key: 'ALL', label: 'All', icon: SlidersHorizontal },
  { key: 'OFFROAD', label: '4x4 Off-Road', icon: Mountain },
  { key: 'LUXURY7', label: '7-Seater Luxury', icon: Gem },
  { key: 'AUTO', label: 'Automatic', icon: Settings2 },
];

function matchesFleetFilter(car: Car, filter: FleetFilter): boolean {
  switch (filter) {
    case 'OFFROAD':
      return car.category === 'SUV';
    case 'LUXURY7':
      // "Spacious or premium" — real seats/category fields, OR'd rather than
      // AND'd so the filter still returns results against a small live catalog.
      return car.seats >= 6 || car.category === 'Luxury';
    case 'AUTO':
      return car.transmission === 'Automatic';
    default:
      return true;
  }
}

const ROAD_TRIPS: { to: string; tag: string; distance: string; icon: LucideIcon; from: string; to2: string }[] = [
  { to: 'Ooty', tag: 'Hill Station', distance: '~270 km from Bengaluru', icon: Mountain, from: '#5872ea', to2: '#183eeb' },
  { to: 'Coorg', tag: 'Coffee Country', distance: '~250 km from Bengaluru', icon: Coffee, from: '#10b981', to2: '#047857' },
  { to: 'Chikmagalur', tag: 'Misty Hills', distance: '~245 km from Bengaluru', icon: TreePine, from: '#8fa3f2', to2: '#1230c4' },
  { to: 'Gokarna', tag: 'Beach Escape', distance: '~480 km from Bengaluru', icon: Waves, from: '#0e259d', to2: '#020617' },
];

/** Cursor-following ambient glow blobs behind a dark section — pure CSS blur, no JS. */
function Glow({ className }: { className: string }) {
  return <div aria-hidden className={`absolute rounded-full blur-[110px] pointer-events-none ${className}`} />;
}

function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HomePage() {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const heroGlowY = useTransform(scrollY, [0, 800], [0, 160]);
  const heroShowcaseY = useTransform(scrollY, [0, 800], [0, -60]);
  const heroContentOpacity = useTransform(scrollY, [0, 500], [1, 0.15]);

  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  const [heroTitle, setHeroTitle] = useState(HERO_TITLE_FALLBACK);
  const [heroSubtitle, setHeroSubtitle] = useState(HERO_SUBTITLE_FALLBACK);
  const [trustBadges, setTrustBadges] = useState<TrustBadge[]>(TRUST_BADGES_FALLBACK);
  const [categories, setCategories] = useState<CategoryDef[]>(CATEGORIES_FALLBACK);
  const [cities, setCities] = useState<CityDef[]>(CITIES_FALLBACK);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(TESTIMONIALS_FALLBACK);
  const [pulse, setPulse] = useState<{ availableCount: number; averageDailyRate: number | null; popularCategory: string | null } | null>(null);

  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('ALL');
  const [showcaseKey, setShowcaseKey] = useState<ShowcaseKey>('offroad');

  // Fare estimator widget state
  const [hub, setHub] = useState(HUBS[0]);
  const [estPickup, setEstPickup] = useState('');
  const [estDropoff, setEstDropoff] = useState('');
  const [fastagAdded, setFastagAdded] = useState(false);

  // Host earnings calculator teaser state — same defaults as the full page
  const [calcDailyRate, setCalcDailyRate] = useState(1800);
  const [calcUtilization, setCalcUtilization] = useState(60);

  // Itinerary unlock (real ₹49 PayU flow + AI-generated content on the callback)
  const { show: showToast } = useToast();
  const [unlockDestination, setUnlockDestination] = useState<ItineraryDestination | null>(null);
  const [unlockName, setUnlockName] = useState('');
  const [unlockEmail, setUnlockEmail] = useState('');
  const [unlockPhone, setUnlockPhone] = useState('');
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);
  const [unlockCheckout, setUnlockCheckout] = useState<{ url: string; fields: Record<string, string> } | null>(null);
  const unlockFormRef = React.useRef<HTMLFormElement>(null);

  async function handleUnlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unlockDestination) return;
    setUnlockSubmitting(true);
    try {
      const res = await itinerariesApi.unlock({
        destination: unlockDestination,
        customerName: unlockName.trim(),
        customerEmail: unlockEmail.trim(),
        customerPhone: unlockPhone.trim(),
      });
      setUnlockCheckout({ url: res.data.url, fields: res.data.fields });
      requestAnimationFrame(() => unlockFormRef.current?.submit());
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not start payment', 'error');
      setUnlockSubmitting(false);
    }
  }

  useEffect(() => {
    let active = true;
    carsApi
      .list({ availableOnly: true, sort: 'featured' })
      .then((res) => {
        if (active) setCars(res.data.slice(0, 9));
      })
      .catch((err) => console.error('Failed to load fleet', err))
      .finally(() => active && setLoading(false));

    settingsApi
      .public()
      .then((res) => {
        if (!active) return;
        const s = res.data;
        if (s.hero_title) setHeroTitle(s.hero_title);
        if (s.hero_subtitle) setHeroSubtitle(s.hero_subtitle);
        if (s.trust_badges?.length) setTrustBadges(s.trust_badges);
        if (s.categories?.length) setCategories(s.categories);
        if (s.cities?.length) setCities(s.cities);
        if (s.testimonials?.length) setTestimonials(s.testimonials);
      })
      .catch((err) => console.error('Failed to load site settings, using defaults', err));

    carsApi
      .marketPulse()
      .then((res) => active && setPulse(res.data))
      .catch(() => {});

    // Default the fare estimator to "tomorrow, one day" so the widget shows
    // a live number immediately instead of an empty state.
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    setEstPickup(toLocalInputValue(start));
    setEstDropoff(toLocalInputValue(end));

    return () => {
      active = false;
    };
  }, []);

  const estDays = useMemo(() => {
    if (!estPickup || !estDropoff) return 1;
    const diff = new Date(estDropoff).getTime() - new Date(estPickup).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [estPickup, estDropoff]);

  const estDailyRate = pulse?.averageDailyRate ?? FALLBACK_DAILY_RATE;
  const estBaseFare = estDays * estDailyRate;
  const estPlatformFee = Math.round(estBaseFare * PLATFORM_FEE_RATE);
  const estTotal = estBaseFare + estPlatformFee + (fastagAdded ? FASTAG_PASS_COST : 0);

  function goToFleetWithDates() {
    if (estPickup && estDropoff) setStickyDates(estPickup, estDropoff);
    window.location.href = '/cars?city=Bengaluru';
  }

  const filteredFleet = useMemo(
    () => (fleetFilter === 'ALL' ? cars : cars.filter((c) => matchesFleetFilter(c, fleetFilter))),
    [cars, fleetFilter]
  );

  const calc = useMemo(() => {
    const daysBooked = Math.round((calcUtilization / 100) * 30);
    const monthlyGross = daysBooked * calcDailyRate;
    const monthlyNet = Math.round(monthlyGross * HOST_SHARE);
    return { daysBooked, monthlyGross, monthlyNet, yearlyNet: monthlyNet * 12 };
  }, [calcDailyRate, calcUtilization]);

  return (
    <div className="min-h-screen bg-slate-950 font-sans">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 pt-28 pb-20 md:pt-36 md:pb-28">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(24,62,235,0.16),transparent_55%)]" />
        <motion.div style={reduceMotion ? undefined : { y: heroGlowY }} aria-hidden className="absolute inset-0 overflow-hidden">
          <Glow className="-top-32 -left-24 w-[30rem] h-[30rem] bg-amber-500/25" />
          <Glow className="top-40 -right-32 w-[26rem] h-[26rem] bg-emerald-500/10" />
        </motion.div>
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
            {/* Copy */}
            <motion.div
              style={reduceMotion ? undefined : { opacity: heroContentOpacity }}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <motion.div
                className="mb-5 inline-flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-full px-4 py-1.5 backdrop-blur-sm"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300 text-xs font-semibold uppercase tracking-widest">
                  Bengaluru&apos;s Premium P2P Self-Drive Marketplace
                </span>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-[3.4rem] font-extrabold text-white leading-[1.08] mb-5 whitespace-pre-line tracking-tight"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
              >
                {heroTitle}
              </motion.h1>
              <motion.p
                className="text-slate-400 text-lg mb-8 max-w-lg leading-relaxed"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.32 }}
              >
                {heroSubtitle}
              </motion.p>

              <motion.div
                className="flex flex-wrap items-center gap-4 mb-10"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.42 }}
              >
                <MotionButton href="/cars" className="btn-gradient text-white font-bold px-7 py-3.5 rounded-xl inline-flex items-center gap-2 text-sm">
                  Browse the Fleet <ArrowRight className="w-4 h-4" />
                </MotionButton>
                <MotionButton
                  href="/host/onboarding"
                  className="border border-slate-700 hover:border-amber-400/60 bg-white/5 backdrop-blur-sm text-white font-semibold px-7 py-3.5 rounded-xl inline-flex items-center gap-2 text-sm transition-colors"
                >
                  Become a Host <ArrowUpRight className="w-4 h-4" />
                </MotionButton>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.55 }}
                className="text-slate-500 text-xs"
              >
                New here?{' '}
                <a href="/get-started" className="text-amber-400 font-semibold hover:underline">
                  Answer 2 quick questions
                </a>{' '}
                and we&apos;ll show you what&apos;s available — no account needed.
              </motion.p>
            </motion.div>

            {/* 3D interactive vehicle showcase */}
            <motion.div
              className="relative"
              style={reduceMotion ? undefined : { y: heroShowcaseY }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
            >
              <TiltCard maxTilt={8} className="relative">
                <div className="relative rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
                  <div className="relative aspect-[4/3]">
                    <Image
                      key={showcaseKey}
                      src={SHOWCASE[showcaseKey].image}
                      alt={`Illustrative ${SHOWCASE[showcaseKey].caption} showcase`}
                      fill
                      priority
                      sizes="(max-width: 1024px) 90vw, 44vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <div>
                      <p className="text-white font-bold text-sm">{SHOWCASE[showcaseKey].caption}</p>
                      <p className="text-slate-300 text-xs">Illustrative — live inventory varies by city &amp; date</p>
                    </div>
                    <span className="bg-white/10 border border-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                      Showcase
                    </span>
                  </div>
                </div>
              </TiltCard>

              {/* Interactive category switcher for the showcase image */}
              <div className="flex gap-2 mt-4 justify-center">
                {(Object.keys(SHOWCASE) as ShowcaseKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setShowcaseKey(key)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                      showcaseKey === key
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white hover:border-amber-400/60'
                    }`}
                  >
                    {SHOWCASE[key].label}
                  </button>
                ))}
              </div>

              {/* Floating holographic metric badges */}
              <motion.div
                className="hidden md:flex absolute -top-6 -left-8 items-center gap-2 bg-slate-900/70 backdrop-blur-xl border border-slate-700/80 rounded-2xl px-4 py-3 shadow-2xl"
                animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-white text-xs font-bold leading-tight">Instant KYC</p>
                  <p className="text-slate-400 text-[10px] leading-tight">&amp; E-Sign</p>
                </div>
              </motion.div>

              <motion.div
                className="hidden md:flex absolute -bottom-6 -right-6 items-center gap-2 bg-slate-900/70 backdrop-blur-xl border border-slate-700/80 rounded-2xl px-4 py-3 shadow-2xl"
                animate={reduceMotion ? undefined : { y: [0, 8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                initial={{ opacity: 0, y: -10 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <Wallet className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-white text-xs font-bold leading-tight">N+1 Day</p>
                  <p className="text-slate-400 text-[10px] leading-tight">Host Settlements</p>
                </div>
              </motion.div>

              <motion.div
                className="hidden lg:flex absolute top-1/2 -right-10 -translate-y-1/2 items-center gap-2 bg-slate-900/70 backdrop-blur-xl border border-slate-700/80 rounded-2xl px-4 py-3 shadow-2xl"
                animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <Route className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-white text-xs font-bold leading-tight">₹49 Smart Itineraries</p>
                  <p className="text-amber-400/80 text-[10px] leading-tight font-semibold">Coming Soon</p>
                </div>
              </motion.div>

              {/* Mobile fallback: badges as a static row below the showcase */}
              <div className="flex md:hidden flex-wrap gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 bg-slate-900/70 border border-slate-700/80 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Instant KYC &amp; E-Sign
                </span>
                <span className="inline-flex items-center gap-1.5 bg-slate-900/70 border border-slate-700/80 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" /> N+1 Day Settlements
                </span>
                <span className="inline-flex items-center gap-1.5 bg-slate-900/70 border border-slate-700/80 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white">
                  <Route className="w-3.5 h-3.5 text-amber-400" /> ₹49 Itineraries · Soon
                </span>
              </div>
            </motion.div>
          </div>

          {/* Search card overlapping into the next section */}
          <motion.div
            className="relative z-10 mt-14 md:mt-20 -mb-24 md:-mb-28"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <SearchBar />
          </motion.div>
        </div>
      </section>

      {/* ── TRUST / MARKET PULSE STRIP ───────────────────────────────── */}
      <section className="relative bg-slate-950 pt-32 md:pt-36 pb-14 border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {pulse && pulse.availableCount > 0 && (
            <StaggerGroup className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <StaggerItem>
                <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl px-5 py-4">
                  <CarFront className="w-8 h-8 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-2xl font-extrabold text-white leading-none">{pulse.availableCount}</div>
                    <div className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">Cars bookable right now</div>
                  </div>
                </div>
              </StaggerItem>
              {pulse.averageDailyRate && (
                <StaggerItem>
                  <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl px-5 py-4">
                    <IndianRupee className="w-8 h-8 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-2xl font-extrabold text-white leading-none">{pulse.averageDailyRate.toLocaleString()}</div>
                      <div className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">Average price per day</div>
                    </div>
                  </div>
                </StaggerItem>
              )}
              {pulse.popularCategory && (
                <StaggerItem>
                  <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl px-5 py-4">
                    <Award className="w-8 h-8 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-2xl font-extrabold text-white leading-none">{pulse.popularCategory}</div>
                      <div className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">Most listed category</div>
                    </div>
                  </div>
                </StaggerItem>
              )}
            </StaggerGroup>
          )}

          <StaggerGroup className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trustBadges.map((b) => (
              <StaggerItem key={b.label}>
                <div className="text-center py-3">
                  <div className="text-xl md:text-2xl font-extrabold text-amber-400">{b.label}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{b.sub}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ── REAL-TIME FARE ESTIMATOR ─────────────────────────────────── */}
      <section className="relative bg-slate-950 py-20 overflow-hidden">
        <Glow className="top-0 left-1/2 -translate-x-1/2 w-[40rem] h-[24rem] bg-amber-500/10" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Live Fare Estimate</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 mb-3">Know the price before you commit</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Pick a hub and your dates for an instant, transparent breakdown — every line item shown upfront, nothing added at pickup.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-0 rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
              {/* Inputs */}
              <div className="p-6 md:p-8 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-800/80">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5" /> Pickup Hub
                  </label>
                  <select
                    value={hub}
                    onChange={(e) => setHub(e.target.value)}
                    className="w-full text-sm px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {HUBS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                      <CalendarClock className="w-3.5 h-3.5" /> Pickup
                    </label>
                    <input
                      type="datetime-local"
                      value={estPickup}
                      onChange={(e) => setEstPickup(e.target.value)}
                      className="w-full text-sm px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                      <CalendarClock className="w-3.5 h-3.5" /> Drop-off
                    </label>
                    <input
                      type="datetime-local"
                      value={estDropoff}
                      onChange={(e) => setEstDropoff(e.target.value)}
                      className="w-full text-sm px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fastagAdded}
                    onChange={(e) => setFastagAdded(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className="text-sm text-slate-200 font-medium">Add FASTag toll pass</span>
                  <span className="ml-auto text-xs text-slate-500">+{formatINR(FASTAG_PASS_COST)} est.</span>
                </label>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Estimate only, based on {pulse?.averageDailyRate ? 'today\'s live average daily rate' : 'a representative daily rate'} for {estDays} day{estDays === 1 ? '' : 's'}.
                  Final pricing depends on the specific car, dates, and add-ons you choose at checkout.
                </p>
              </div>

              {/* Live breakdown */}
              <div className="p-6 md:p-8 bg-slate-950/40 flex flex-col">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Fare Breakdown</p>
                <div className="space-y-3 text-sm flex-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Base Fare ({estDays} day{estDays === 1 ? '' : 's'} × {formatINR(estDailyRate)})</span>
                    <span className="font-semibold text-white">{formatINR(estBaseFare)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Platform Fee (8%)</span>
                    <span className="font-semibold text-white">{formatINR(estPlatformFee)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>FASTag Pass {!fastagAdded && <span className="text-slate-600">(not added)</span>}</span>
                    <span className="font-semibold text-white">{fastagAdded ? formatINR(FASTAG_PASS_COST) : '—'}</span>
                  </div>
                  <div className="h-px bg-slate-800 my-2" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-200 font-semibold">Estimated Total</span>
                    <span className="text-2xl font-extrabold text-amber-400">{formatINR(estTotal)}</span>
                  </div>
                </div>
                <MotionButton
                  onClick={goToFleetWithDates}
                  className="btn-gradient text-white font-bold px-6 py-3.5 rounded-xl inline-flex items-center justify-center gap-2 text-sm mt-6"
                >
                  Find Cars at {hub} <ChevronRight className="w-4 h-4" />
                </MotionButton>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── CATEGORY QUICK NAV ───────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Browse by Category</h2>
            <p className="text-gray-500 text-sm mb-8">From budget hatchbacks to luxury cruisers</p>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.label];
              return (
                <StaggerItem key={cat.label}>
                  <motion.a
                    href={`/cars?category=${cat.label}`}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-amber-400 hover:bg-amber-50 transition-colors group"
                  >
                    <motion.span
                      whileHover={{ scale: 1.15, rotate: 4 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className="w-11 h-11 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-500"
                    >
                      {Icon ? <Icon className="w-5 h-5" /> : <span className="text-xl">{cat.icon}</span>}
                    </motion.span>
                    <span className="text-sm font-semibold text-gray-800 group-hover:text-amber-600">{cat.label}</span>
                    <span className="text-xs text-gray-400 text-center">{cat.desc}</span>
                  </motion.a>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* ── 3D FLEET SHOWCASE ─────────────────────────────────────────── */}
      <section className="relative bg-slate-950 py-20 overflow-hidden">
        <Glow className="bottom-0 right-0 w-[34rem] h-[28rem] bg-amber-500/10" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Live Fleet</span>
                <h2 className="text-3xl font-extrabold text-white mt-2">Explore the fleet in 3D</h2>
                <p className="text-slate-400 text-sm mt-1">Tilt any card — real listings, filtered by real specs.</p>
              </div>
              <a href="/cars" className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition inline-flex items-center gap-1 shrink-0">
                View full fleet <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="flex flex-wrap gap-2 mb-8">
              {FLEET_FILTERS.map((f) => {
                const Icon = f.icon;
                const active = fleetFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFleetFilter(f.key)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-amber-400/60 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {f.label}
                  </button>
                );
              })}
            </div>
          </ScrollReveal>

          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <CarCardSkeleton key={i} />)
              : filteredFleet.length === 0
              ? (
                <p className="col-span-full text-center text-slate-500 py-10">
                  No cars currently match this filter — check back soon, or{' '}
                  <a href="/cars" className="text-amber-400 hover:underline">browse the full fleet</a>.
                </p>
              )
              : filteredFleet.map((car) => (
                <StaggerItem key={car.id}>
                  <TiltCard maxTilt={6} className="relative h-full">
                    <span className="absolute -top-3 left-4 z-20 inline-flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                      <BadgeCheck className="w-3 h-3" /> Verified &amp; Inspected
                    </span>
                    <div className="h-full [transform:translateZ(20px)]">
                      <CarCard car={car} />
                    </div>
                  </TiltCard>
                </StaggerItem>
              ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ── DUAL VALUE PROPOSITION ───────────────────────────────────── */}
      <section className="relative bg-slate-950 py-20 overflow-hidden">
        <Glow className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[46rem] h-[30rem] bg-emerald-500/5" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">Built for both sides of the trip</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">Whether you&apos;re renting for the weekend or turning a car into income, everything is transparent from day one.</p>
          </ScrollReveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Lessee */}
            <ScrollReveal direction="left">
              <div className="h-full flex flex-col rounded-3xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.07] to-slate-900/60 backdrop-blur-xl p-8">
                <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center mb-5">
                  <CarFront className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-xl font-extrabold text-white mb-1">For Lessees</h3>
                <p className="text-slate-400 text-sm mb-6">Everything shown upfront — no surprises at pickup.</p>

                <ul className="space-y-4 flex-1">
                  <li className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">Zero hidden fees</p>
                      <p className="text-slate-400 text-xs mt-0.5">Every charge — base fare, platform fee, deposit — itemized before you pay.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <FileCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">Digital tripartite lease agreement</p>
                      <p className="text-slate-400 text-xs mt-0.5">Every trip is backed by a legally binding, e-signed agreement between you, your host, and ZiyamSelfDrive.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Wallet className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">In-app Z-Credits wallet</p>
                      <p className="text-slate-400 text-xs mt-0.5">Earn referral credits and apply them straight to your next booking.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Route className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">
                        ₹49 road-trip itineraries <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider ml-1">Coming Soon</span>
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">Curated day-trip routes out of Bengaluru, unlocked for a flat ₹49.</p>
                    </div>
                  </li>
                </ul>

                <MotionButton href="/cars" className="btn-gradient text-white font-bold px-6 py-3 rounded-xl inline-flex items-center justify-center gap-2 text-sm mt-8">
                  Browse the Fleet <ArrowRight className="w-4 h-4" />
                </MotionButton>
              </div>
            </ScrollReveal>

            {/* Host / Fleet */}
            <ScrollReveal direction="right">
              <div className="h-full flex flex-col rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.07] to-slate-900/60 backdrop-blur-xl p-8">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-5">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-xl font-extrabold text-white mb-1">For Hosts &amp; Fleets</h3>
                <p className="text-slate-400 text-sm mb-6">Turn idle cars into a reliable, tracked income stream.</p>

                <ul className="space-y-4 flex-1">
                  <li className="flex gap-3">
                    <IndianRupee className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">Earn ₹25,000 – ₹45,000+/month</p>
                      <p className="text-slate-400 text-xs mt-0.5">Real payouts from real hosts already on the platform, based on daily rate and utilization.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Radio className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">Multi-platform syndication</p>
                      <p className="text-slate-400 text-xs mt-0.5 mb-2">Track earnings across every platform your fleet runs on, reconciled in one dashboard.</p>
                      <div className="flex flex-wrap gap-1.5">
                        {['Zoomcar', 'Revv', 'Bharat Cars', 'Ziyam Direct'].map((p) => (
                          <span key={p} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">{p}</span>
                        ))}
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Clock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">Guaranteed N+1 day payout</p>
                      <p className="text-slate-400 text-xs mt-0.5">Cleared to your linked bank account within 1 business day of a completed trip.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <BadgeCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">Facilitation fees as low as 18%</p>
                      <p className="text-slate-400 text-xs mt-0.5">Keep more of every fare — rates range from 18–28% depending on vehicle tier and performance.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Camera className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">
                        JioOBD / dashcam safety integration <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider ml-1">Roadmap</span>
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">Live telemetry and dashcam integration for fleet safety monitoring — planned, not yet live.</p>
                    </div>
                  </li>
                </ul>

                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <MotionButton
                    href="/host/onboarding"
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-3 rounded-xl inline-flex items-center justify-center gap-2 text-sm transition-colors"
                  >
                    Start Earning <ArrowRight className="w-4 h-4" />
                  </MotionButton>
                  <MotionButton
                    href="#earnings-calculator"
                    className="flex-1 border border-slate-700 hover:border-emerald-400/60 text-white font-semibold px-6 py-3 rounded-xl inline-flex items-center justify-center gap-2 text-sm transition-colors"
                  >
                    Calculate Earnings
                  </MotionButton>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── HOST EARNINGS CALCULATOR TEASER ──────────────────────────── */}
      <section id="earnings-calculator" className="py-20 bg-white scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="text-marc8accent text-xs font-bold uppercase tracking-widest">For Car Owners</span>
            <h2 className="text-3xl font-extrabold text-gray-900 mt-2 mb-3">What could your car earn?</h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">A quick preview — same formula as the full calculator, so the numbers always match.</p>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="bg-gray-50 rounded-3xl border border-gray-100 p-8 md:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700">Your daily rate</label>
                    <span className="text-amber-500 font-bold">{formatINR(calcDailyRate)}/day</span>
                  </div>
                  <input
                    type="range" min={800} max={9000} step={100}
                    value={calcDailyRate} onChange={(e) => setCalcDailyRate(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700">Expected utilization</label>
                    <span className="text-amber-500 font-bold">{calcUtilization}% of days booked</span>
                  </div>
                  <input
                    type="range" min={10} max={100} step={5}
                    value={calcUtilization} onChange={(e) => setCalcUtilization(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Days Booked / Month</p>
                  <p className="text-2xl font-extrabold text-gray-900">{calc.daysBooked}</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Your Monthly Earnings (70%)</p>
                  <p className="text-2xl font-extrabold text-emerald-600">{formatINR(calc.monthlyNet)}</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Estimated Yearly</p>
                  <p className="text-2xl font-extrabold text-gray-900">{formatINR(calc.yearlyNet)}</p>
                </div>
              </div>

              <div className="text-center mt-8">
                <a
                  href="/host/earnings-calculator"
                  className="inline-flex items-center gap-2 text-amber-500 hover:text-amber-600 font-semibold text-sm"
                >
                  Open the full calculator with monthly projections <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── ROAD TRIP ITINERARIES TEASER ─────────────────────────────── */}
      <section id="itineraries" className="relative bg-slate-950 py-20 overflow-hidden">
        <Glow className="top-0 left-0 w-[30rem] h-[26rem] bg-amber-500/10" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">AI-Generated · ₹49</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 mb-3">Smart road-trip itineraries</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              A day-by-day route plan out of Bengaluru, generated for you the moment you unlock it — stops, timing, and self-drive tips included. Distances are approximate.
            </p>
          </ScrollReveal>

          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ROAD_TRIPS.map((trip) => {
              const Icon = trip.icon;
              return (
                <StaggerItem key={trip.to}>
                  <motion.div
                    whileHover={{ y: -6 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="relative rounded-2xl overflow-hidden border border-slate-800/80 h-56 flex flex-col justify-between p-5"
                    style={{ backgroundImage: `linear-gradient(155deg, ${trip.from}, ${trip.to2})` }}
                  >
                    <div className="flex items-start justify-between">
                      <Icon className="w-7 h-7 text-white/90" />
                      <span className="bg-black/25 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full">₹49</span>
                    </div>
                    <div>
                      <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wider mb-1">{trip.tag}</p>
                      <h3 className="text-white font-extrabold text-lg mb-1">Bengaluru → {trip.to}</h3>
                      <p className="text-white/70 text-xs mb-3">{trip.distance}</p>
                      <button
                        type="button"
                        onClick={() => setUnlockDestination(trip.to as ItineraryDestination)}
                        className="inline-flex items-center gap-1 text-white text-xs font-bold bg-white/15 hover:bg-white/25 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Unlock Itinerary <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      <Modal open={Boolean(unlockDestination)} onClose={() => { if (!unlockSubmitting) { setUnlockDestination(null); setUnlockCheckout(null); } }} title={`Unlock: Bengaluru → ${unlockDestination}`}>
        <form onSubmit={handleUnlockSubmit} className="space-y-4">
          <p className="text-sm text-gray-500">
            ₹49 unlocks an AI-generated day-by-day itinerary for this route — stops, timing, attractions, and self-drive tips, ready right after payment.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
            <input required value={unlockName} onChange={(e) => setUnlockName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
            <input type="email" required value={unlockEmail} onChange={(e) => setUnlockEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Mobile Number</label>
            <input type="tel" required value={unlockPhone} onChange={(e) => setUnlockPhone(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          <button
            type="submit"
            disabled={unlockSubmitting}
            className="w-full btn-gradient text-white font-bold py-3 rounded-xl transition disabled:opacity-60"
          >
            {unlockSubmitting ? 'Redirecting to PayU…' : 'Pay ₹49 & Unlock'}
          </button>
          <p className="text-[11px] text-gray-400 text-center">🔒 Secure checkout via PayU. No account needed.</p>
        </form>

        {/* Hidden auto-submitting form to PayU's hosted checkout — a sibling of
            the form above, never nested inside it (nested <form> is invalid
            HTML and browsers will hoist/break it unpredictably). */}
        <form ref={unlockFormRef} action={unlockCheckout?.url} method="POST" className="hidden">
          {unlockCheckout && Object.entries(unlockCheckout.fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
      </Modal>

      {/* ── TOP CITIES ───────────────────────────────────────────────── */}
      <section className="py-16 bg-marc8cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Where We Operate</h2>
            <p className="text-gray-500 text-sm mb-8">Now live in Bengaluru — expanding pan-India soon</p>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {cities.map((c) => (
              <StaggerItem key={c.name}>
                <motion.a
                  href={`/cities/${encodeURIComponent(c.name)}`}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="flex flex-col items-center gap-2 p-5 bg-white rounded-2xl shadow-sm hover:shadow-md hover:border-amber-400 border border-gray-100 transition-colors text-center"
                >
                  <span className="text-3xl">{c.emoji}</span>
                  <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                </motion.a>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">What Our Community Says</h2>
              <p className="text-gray-500 text-sm mb-10 text-center">Real feedback from lessees and hosts</p>
            </ScrollReveal>
            <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <StaggerItem key={i}>
                  <motion.div
                    whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.12)' }}
                    className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full"
                  >
                    <div className="flex gap-0.5 text-amber-400 mb-3">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className={`w-4 h-4 ${s < t.rating ? 'fill-amber-400' : 'fill-transparent text-gray-200'}`} />
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
                        {t.name.slice(0, 1)}
                      </span>
                      <span className="text-sm font-semibold text-gray-800">{t.name}</span>
                    </div>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="relative py-20 bg-slate-950 text-white overflow-hidden">
        <Glow className="top-0 right-1/4 w-[26rem] h-[22rem] bg-amber-500/10" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl font-extrabold mb-2">How ZiyamSelfDrive Works</h2>
            <p className="text-slate-400 mb-12">Rent a car in 4 simple steps</p>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {HOW_STEPS.map((step, i) => (
              <StaggerItem key={step.title}>
                <div className="relative">
                  {i < HOW_STEPS.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-full w-full h-px bg-amber-500/30 -translate-x-1/2" />
                  )}
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: -4 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  >
                    <step.icon className="w-7 h-7 text-amber-400" />
                  </motion.div>
                  <div className="text-xs text-amber-400 font-bold uppercase tracking-widest mb-1">Step {i + 1}</div>
                  <h3 className="font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
          <MotionButton
            href="/how-it-works"
            className="inline-block mt-12 border border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-white text-sm font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Learn More
          </MotionButton>
        </div>
      </section>

      {/* ── TRUST & CONCIERGE ────────────────────────────────────────── */}
      <section className="relative bg-slate-950 py-16 border-t border-slate-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
              <Building2 className="w-8 h-8 text-amber-400 shrink-0" />
              <div>
                <p className="text-white font-bold text-sm">{COMPANY.legalName}</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  CIN {COMPANY.cin} · {COMPANY.address}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
              <div className="flex -space-x-2 shrink-0">
                <span className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-slate-900">
                  <MessageCircle className="w-4 h-4 text-white" />
                </span>
                <span className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center border-2 border-slate-900">
                  <Mail className="w-4 h-4 text-white" />
                </span>
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">Talk to a human, instantly</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <a href={COMPANY.whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
                    WhatsApp Concierge
                  </a>
                  <a href={`mailto:${COMPANY.email}`} className="text-amber-400 hover:text-amber-300 text-xs font-semibold">
                    {COMPANY.email}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {/* Floating WhatsApp concierge button */}
      <motion.a
        href={COMPANY.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with ZiyamSelfDrive on WhatsApp"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-2xl shadow-emerald-500/30"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </motion.a>
    </div>
  );
}
