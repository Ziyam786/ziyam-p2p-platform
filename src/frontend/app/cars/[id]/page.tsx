'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import Rating from '../../../components/Rating';
import CarLocationMap from '../../../components/CarLocationMap';
import PauseCalendar from '../../../components/PauseCalendar';
import { useAuth } from '../../../lib/auth-context';
import { useToast } from '../../../components/Toast';
import { carsApi, bookingsApi, settingsApi, promoApi, ApiError } from '../../../lib/api';
import { getStickyDates } from '../../../lib/searchDates';
import { computeDemandMultiplier, DEMAND_PRICING_FALLBACK } from '../../../lib/demandPricing';
import type { AvailabilityRange } from '../../../lib/api';
import type { Car, DemandPricing, LongRentalDiscount, Review } from '../../../lib/types';

const INCLUDED_ITEMS = [
  { icon: '⛽', label: 'Fuel not included' },
  { icon: '📄', label: 'Host carries comprehensive vehicle insurance' },
  { icon: '📞', label: '24/7 roadside assistance (breakdowns)' },
];

// No plan transfers vehicle-damage liability to the platform — see the
// Damage & Insurance section below. These only change the deposit handling
// and support responsiveness.
const PROTECTION_PLANS = [
  { value: 'BASIC', label: 'Basic', ratePerDay: 0, desc: 'Standard deposit terms, included free.' },
  { value: 'STANDARD', label: 'Standard', ratePerDay: 149, desc: 'Reduced deposit hold + priority roadside assistance.' },
  { value: 'PREMIUM', label: 'Premium', ratePerDay: 349, desc: 'Lowest deposit hold + 24/7 priority support.' },
] as const;

// Flat one-time fee, not per-day — a second named driver covered on the
// lease agreement and the host's insurance for this trip.
const CODRIVER_FEE = 500;

const LONG_RENTAL_DISCOUNTS_FALLBACK: LongRentalDiscount[] = [
  { minDays: 3, percent: 0.05 },
  { minDays: 5, percent: 0.10 },
  { minDays: 10, percent: 0.15 },
];

export default function CarDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { show } = useToast();

  const [car, setCar] = useState<(Car & { reviews: Review[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [plan, setPlan] = useState<'BASIC' | 'STANDARD' | 'PREMIUM'>('BASIC');
  const [submitting, setSubmitting] = useState(false);
  const [longRentalDiscounts, setLongRentalDiscounts] = useState<LongRentalDiscount[]>(LONG_RENTAL_DISCOUNTS_FALLBACK);
  const [deliveryMode, setDeliveryMode] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [coDriverRequested, setCoDriverRequested] = useState(false);
  const [coDriverName, setCoDriverName] = useState('');
  const [coDriverLicenseNumber, setCoDriverLicenseNumber] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoChecking, setPromoChecking] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityRange[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [demandPricing, setDemandPricing] = useState<DemandPricing>(DEMAND_PRICING_FALLBACK);

  // Carry over the dates picked on the homepage/search bar so the renter
  // doesn't have to re-enter them for whichever car they click into.
  useEffect(() => {
    const sticky = getStickyDates();
    if (sticky) {
      setPickup(sticky.pickup);
      setDropoff(sticky.dropoff);
    }
  }, []);

  useEffect(() => {
    let active = true;
    carsApi
      .get(params.id)
      .then((res) => {
        if (!active) return;
        setCar(res.data);
        setActiveImg(res.data.images?.[0] ?? '');
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false));
    carsApi.availability(params.id).then((res) => active && setAvailability(res.data)).catch(() => {});
    settingsApi
      .public()
      .then((res) => {
        if (!active) return;
        if (res.data.long_rental_discounts?.length) setLongRentalDiscounts(res.data.long_rental_discounts);
        if (res.data.demand_pricing) setDemandPricing(res.data.demand_pricing);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [params.id]);

  const days = useMemo(() => {
    if (!pickup || !dropoff) return 0;
    const diff = new Date(dropoff).getTime() - new Date(pickup).getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [pickup, dropoff]);

  const demand = useMemo(
    () => (pickup ? computeDemandMultiplier(new Date(pickup), demandPricing) : { multiplier: 1, isWeekend: false, isPeakHour: false, isHoliday: false }),
    [pickup, demandPricing]
  );
  const effectiveDailyRate = (car?.dailyRate ?? 0) * demand.multiplier;
  const baseFareRaw = days * effectiveDailyRate;
  const longRentalPercent = useMemo(() => {
    const eligible = longRentalDiscounts.filter((d) => days >= d.minDays);
    return eligible.length ? Math.max(...eligible.map((d) => d.percent)) : 0;
  }, [longRentalDiscounts, days]);
  const longRentalDiscountAmount = Math.round(baseFareRaw * longRentalPercent);
  const baseFare = baseFareRaw - longRentalDiscountAmount;

  const protectionFee = days * (PROTECTION_PLANS.find((p) => p.value === plan)?.ratePerDay ?? 0);
  const deliveryFee = deliveryMode === 'DELIVERY' ? (car?.deliveryFee ?? 0) : 0;
  const coDriverFee = coDriverRequested ? CODRIVER_FEE : 0;
  const promoDiscount = appliedPromo?.discount ?? 0;
  const preFeeSubtotal = Math.max(0, baseFare + protectionFee + deliveryFee + coDriverFee - promoDiscount);
  const platformFee = Math.round(preFeeSubtotal * 0.08);
  const securityDeposit = car?.securityDeposit ?? 0;
  const total = preFeeSubtotal + platformFee + securityDeposit;

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setPromoChecking(true);
    setPromoError('');
    try {
      const res = await promoApi.validate(promoInput.trim(), baseFare + protectionFee + deliveryFee + coDriverFee);
      setAppliedPromo(res.data);
      show(`Promo applied — ₹${res.data.discount.toLocaleString()} off`, 'success');
    } catch (err: any) {
      setPromoError(err.message ?? 'Invalid promo code');
      setAppliedPromo(null);
    } finally {
      setPromoChecking(false);
    }
  }

  async function handleBook() {
    if (!car) return;
    if (!user) {
      router.push(`/login?redirect=/cars/${car.id}`);
      return;
    }
    if (days === 0) return;
    if (coDriverRequested && (!coDriverName.trim() || !coDriverLicenseNumber.trim())) {
      show('Enter the co-driver\'s name and license number, or turn off the co-driver add-on', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await bookingsApi.create({
        carId: car.id,
        startTime: new Date(pickup).toISOString(),
        endTime: new Date(dropoff).toISOString(),
        totalAmount: preFeeSubtotal + platformFee,
        protectionPlan: plan,
        deliveryRequested: deliveryMode === 'DELIVERY',
        coDriverRequested,
        coDriverName: coDriverRequested ? coDriverName.trim() : undefined,
        coDriverLicenseNumber: coDriverRequested ? coDriverLicenseNumber.trim() : undefined,
        promoCode: appliedPromo?.code,
      });
      router.push(`/checkout/${res.bookingId}`);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'KYC_REQUIRED') {
        show('Complete KYC verification to book a car — taking you there now.', 'error');
        router.push('/account/kyc');
        return;
      }
      show(err.message ?? 'Could not start booking', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading car…</p>
      </div>
    );
  }

  if (notFound || !car) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 pt-40 pb-24 text-center">
          <span className="text-5xl block mb-4">🚗</span>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Car not found</h1>
          <p className="text-gray-500 text-sm mb-6">This listing may have been removed or delisted.</p>
          <a href="/cars" className="text-amber-500 font-semibold underline">Browse other cars</a>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        {/* Breadcrumb */}
        <div className="text-xs text-gray-400 mb-6 flex items-center gap-2">
          <a href="/" className="hover:text-amber-500">Home</a>
          <span>/</span>
          <a href="/cars" className="hover:text-amber-500">Cars</a>
          <span>/</span>
          <span className="text-gray-700">{car.make} {car.model}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* ── LEFT: Images + Details ─────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero image */}
            <div className="relative rounded-2xl overflow-hidden h-72 md:h-96 bg-gray-200">
              {activeImg && (
                <Image src={activeImg} alt={`${car.make} ${car.model}`} fill priority sizes="(max-width: 1024px) 100vw, 66vw" className="object-cover" />
              )}
            </div>

            {/* Thumbnails */}
            {car.images.length > 1 && (
              <div className="flex gap-3">
                {car.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(img)}
                    className={`relative w-20 h-14 rounded-xl overflow-hidden border-2 transition ${
                      activeImg === img ? 'border-amber-500' : 'border-transparent'
                    }`}
                  >
                    <Image src={img} alt="" fill sizes="80px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Car title */}
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-extrabold text-gray-900">
                  {car.make} {car.model} {car.year}
                </h1>
                <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {car.category}
                </span>
                {car.instantBook && (
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    ⚡ Instant Book
                  </span>
                )}
                {car.isAvailable ? (
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    Available
                  </span>
                ) : (
                  <span className="bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    Booked
                  </span>
                )}
                {car.securityDeposit === 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    💰 Zero Deposit
                  </span>
                )}
                {car.offersDelivery && (
                  <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    🚚 Delivery Available
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-1">📍 {car.city}</p>
              <div className="mt-2">
                <Rating value={car.rating} count={car.reviewCount} size="md" />
              </div>
            </div>

            {/* Specs chips */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: '🔧', label: car.transmission },
                { icon: '⛽', label: car.fuelType },
                { icon: '💺', label: `${car.seats} Seats` },
                { icon: '🛣️', label: `${car.kmIncludedPerDay} km/day` },
                { icon: '➕', label: `₹${car.extraKmCharge}/extra km` },
              ].map((s) => (
                <span key={s.label} className="bg-gray-100 text-gray-700 text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  {s.icon} {s.label}
                </span>
              ))}
            </div>

            {/* Description */}
            {car.description && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h2 className="font-bold text-gray-900 mb-2">About this car</h2>
                <p className="text-gray-600 text-sm leading-relaxed">{car.description}</p>
              </div>
            )}

            {/* Features */}
            {car.features.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h2 className="font-bold text-gray-900 mb-4">Features & Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {car.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-emerald-500">✓</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What's included */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4">What's Included</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex flex-col items-center text-center gap-1">
                  <span className="text-2xl">🛣️</span>
                  <span className="text-xs text-gray-600">{car.kmIncludedPerDay} km/day included</span>
                </div>
                {INCLUDED_ITEMS.map((item) => (
                  <div key={item.label} className="flex flex-col items-center text-center gap-1">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-xs text-gray-600">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pickup location */}
            {car.latitude && car.longitude && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h2 className="font-bold text-gray-900 mb-1">Pickup Location</h2>
                <p className="text-xs text-gray-500 mb-3">{car.address ?? car.city}</p>
                <CarLocationMap latitude={car.latitude} longitude={car.longitude} label={`${car.make} ${car.model}`} />
              </div>
            )}

            {/* Host info */}
            {car.owner && (
              <a
                href={`/hosts/${car.ownerId}`}
                className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center gap-5 hover:border-amber-300 transition"
              >
                <div className="relative w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl overflow-hidden">
                  {car.owner.avatarUrl ? (
                    <Image src={car.owner.avatarUrl} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    '👤'
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Hosted by</p>
                  <p className="font-bold text-gray-900">{car.owner.fullName}</p>
                  <p className="text-xs text-amber-500 font-semibold">View host profile →</p>
                </div>
              </a>
            )}

            {/* Reviews */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4">
                Reviews {car.reviewCount > 0 && `(${car.reviewCount})`}
              </h2>
              {car.reviews.length === 0 ? (
                <p className="text-sm text-gray-400">No reviews yet. Be the first to rent and review this car.</p>
              ) : (
                <div className="space-y-4">
                  {car.reviews.map((r) => (
                    <div key={r.id} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-800 text-sm">{r.author?.fullName ?? 'Lessee'}</span>
                        <Rating value={r.rating} />
                      </div>
                      {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Booking card ────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-5">
              <div>
                <span className="text-3xl font-extrabold text-amber-500">₹{car.dailyRate.toLocaleString()}</span>
                <span className="text-gray-400 text-sm">/day</span>
              </div>

              <hr className="border-gray-100" />

              {/* Availability calendar (read-only) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowCalendar((s) => !s)}
                  className="text-xs font-semibold text-amber-500 hover:text-amber-600 flex items-center gap-1"
                >
                  📅 {showCalendar ? 'Hide' : 'View'} availability calendar
                </button>
                {showCalendar && (
                  <div className="mt-3 bg-gray-50 rounded-xl p-3">
                    <PauseCalendar
                      interactive={false}
                      blackouts={availability.filter((r) => r.type === 'PAUSED').map((r) => ({ id: r.startDate + r.endDate, carId: car.id, startDate: r.startDate, endDate: r.endDate, reason: r.reason ?? null, createdAt: r.startDate }))}
                      bookedDates={(() => {
                        const set = new Set<string>();
                        availability.filter((r) => r.type === 'BOOKED').forEach((r) => {
                          for (let d = new Date(r.startDate); d <= new Date(r.endDate); d.setDate(d.getDate() + 1)) {
                            set.add(new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10));
                          }
                        });
                        return set;
                      })()}
                      rangeStart={null}
                      rangeEnd={null}
                      monthsAhead={2}
                    />
                  </div>
                )}
              </div>

              {/* Date pickers */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Pickup Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={pickup}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setPickup(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Drop-off Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={dropoff}
                  min={pickup || new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setDropoff(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Delivery vs self-pickup */}
              {days > 0 && car.offersDelivery && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Pickup Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryMode('PICKUP')}
                      className={`p-2.5 rounded-xl border-2 text-sm font-semibold transition ${
                        deliveryMode === 'PICKUP' ? 'border-amber-500 bg-amber-50 text-gray-900' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      🏠 Self Pickup
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryMode('DELIVERY')}
                      className={`p-2.5 rounded-xl border-2 text-sm font-semibold transition ${
                        deliveryMode === 'DELIVERY' ? 'border-amber-500 bg-amber-50 text-gray-900' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      🚚 Delivery {car.deliveryFee > 0 ? `(+₹${car.deliveryFee})` : '(Free)'}
                    </button>
                  </div>
                </div>
              )}

              {/* Protection plan */}
              {days > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Protection Plan
                  </label>
                  <div className="space-y-2">
                    {PROTECTION_PLANS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPlan(p.value)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition ${
                          plan === p.value ? 'border-amber-500 bg-amber-50' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm text-gray-900">{p.label}</span>
                          <span className="text-xs font-bold text-gray-700">
                            {p.ratePerDay === 0 ? 'Free' : `+₹${p.ratePerDay}/day`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Co-driver add-on */}
              {days > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setCoDriverRequested(!coDriverRequested)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition ${
                      coDriverRequested ? 'border-amber-500 bg-amber-50' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm text-gray-900">👤 Add a co-driver</span>
                      <span className="text-xs font-bold text-gray-700">+₹{CODRIVER_FEE}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">A second named driver, covered on the lease agreement and insurance for this trip.</p>
                  </button>
                  {coDriverRequested && (
                    <div className="mt-2 space-y-2">
                      <input
                        value={coDriverName}
                        onChange={(e) => setCoDriverName(e.target.value)}
                        placeholder="Co-driver's full name"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <input
                        value={coDriverLicenseNumber}
                        onChange={(e) => setCoDriverLicenseNumber(e.target.value)}
                        placeholder="Co-driver's driving license number"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Promo code */}
              {days > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Promo Code
                  </label>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      <span className="text-sm font-semibold text-emerald-700">✓ {appliedPromo.code} applied</span>
                      <button
                        type="button"
                        onClick={() => { setAppliedPromo(null); setPromoInput(''); }}
                        className="text-xs text-emerald-600 hover:text-emerald-800 underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={promoInput}
                        onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                        placeholder="e.g. ZIYAM10"
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        disabled={promoChecking || !promoInput.trim()}
                        onClick={applyPromo}
                        className="bg-gray-900 hover:bg-black disabled:bg-gray-200 text-white text-sm font-semibold px-4 rounded-xl transition"
                      >
                        {promoChecking ? '…' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {promoError && <p className="text-xs text-red-500 mt-1">{promoError}</p>}
                </div>
              )}

              {/* Fare breakdown */}
              {days > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-700">
                    <span>₹{car.dailyRate.toLocaleString()} × {days} day{days > 1 ? 's' : ''}</span>
                    <span>₹{(days * car.dailyRate).toLocaleString()}</span>
                  </div>
                  {demand.multiplier > 1 && (
                    <div className="flex justify-between text-amber-600">
                      <span>
                        Demand pricing (+{Math.round((demand.multiplier - 1) * 100)}%
                        {demand.isHoliday ? ' · holiday' : demand.isWeekend ? ' · weekend' : ''}
                        {demand.isPeakHour ? ' · peak hours' : ''})
                      </span>
                      <span>+₹{Math.round(baseFareRaw - days * car.dailyRate).toLocaleString()}</span>
                    </div>
                  )}
                  {longRentalDiscountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Long rental discount ({Math.round(longRentalPercent * 100)}%)</span>
                      <span>−₹{longRentalDiscountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {protectionFee > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>{plan} protection</span>
                      <span>₹{protectionFee.toLocaleString()}</span>
                    </div>
                  )}
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Doorstep delivery</span>
                      <span>₹{deliveryFee.toLocaleString()}</span>
                    </div>
                  )}
                  {coDriverFee > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Co-driver add-on</span>
                      <span>₹{coDriverFee.toLocaleString()}</span>
                    </div>
                  )}
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Promo ({appliedPromo?.code})</span>
                      <span>−₹{promoDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-500">
                    <span>Platform fee (8%)</span>
                    <span>₹{platformFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Security deposit (refundable)</span>
                    <span>₹{securityDeposit.toLocaleString()}</span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>Total</span>
                    <span className="text-amber-600">₹{total.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {user && !user.isKycVerified && (
                <a href="/account/kyc" className="block text-center text-xs font-semibold bg-amber-50 text-amber-700 rounded-xl px-3 py-2.5 hover:bg-amber-100 transition">
                  🪪 KYC verification is required to book — complete it here first
                </a>
              )}

              <button
                disabled={!car.isAvailable || days === 0 || submitting}
                onClick={handleBook}
                className="w-full btn-gradient active:scale-[0.98] disabled:!bg-none disabled:bg-gray-200 disabled:!shadow-none disabled:text-gray-400 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-bold py-3.5 rounded-xl transition-transform text-base"
              >
                {submitting
                  ? 'Starting booking…'
                  : !car.isAvailable
                  ? 'Car Unavailable'
                  : days === 0
                  ? 'Select Dates to Book'
                  : user
                  ? 'Proceed to Book'
                  : 'Log In to Book'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                You won't be charged yet. Review before confirming.
              </p>

              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                <span>🔒 Secure Payment</span>
                <span>·</span>
                <span>🪪 KYC-Verified Host</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
