'use client';

import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SearchBar from '../components/SearchBar';
import CarCard from '../components/CarCard';
import { CarCardSkeleton } from '../components/Skeleton';
import ScrollReveal, { StaggerGroup, StaggerItem } from '../components/ScrollReveal';
import MotionButton from '../components/MotionButton';
import { carsApi, settingsApi } from '../lib/api';
import type { Car, CategoryDef, CityDef, Testimonial, TrustBadge } from '../lib/types';

const CITIES_FALLBACK: CityDef[] = [
  { name: 'Bengaluru', emoji: '🏙️' },
  { name: 'Mumbai', emoji: '🌊' },
  { name: 'Delhi NCR', emoji: '🕌' },
  { name: 'Hyderabad', emoji: '🏯' },
  { name: 'Chennai', emoji: '🎭' },
  { name: 'Pune', emoji: '🎓' },
];

const HOW_STEPS = [
  {
    icon: '🔍',
    title: 'Search & Filter',
    desc: 'Choose your city, dates, and preferred car category. We show real-time availability.',
  },
  {
    icon: '📋',
    title: 'Instant KYC',
    desc: 'Upload your driving licence once. Verification is instant via DigiLocker.',
  },
  {
    icon: '💳',
    title: 'Pay Securely',
    desc: 'Pay via UPI, card, or wallet. Security deposit held in escrow — released at trip end.',
  },
  {
    icon: '🚗',
    title: 'Drive Free',
    desc: 'Pick up the car at the host location. Drive wherever you want — you are in control.',
  },
];

const TRUST_BADGES_FALLBACK: TrustBadge[] = [
  { label: '1 Lakh+', sub: 'Happy Renters' },
  { label: '5,000+', sub: 'Verified Cars' },
  { label: '30+ Cities', sub: 'Pan-India' },
  { label: '4.6 ★', sub: 'Average Rating' },
];

const CATEGORIES_FALLBACK: CategoryDef[] = [
  { label: 'Hatchback', icon: '🚘', desc: 'Compact & affordable' },
  { label: 'Sedan', icon: '🚗', desc: 'Comfortable & stylish' },
  { label: 'SUV', icon: '🛻', desc: 'Space for the family' },
  { label: 'Luxury', icon: '🏎️', desc: 'Premium experience' },
  { label: 'EV', icon: '⚡', desc: 'Zero-emission trips' },
  { label: 'MUV', icon: '🚐', desc: 'Group travel' },
];

const HERO_TITLE_FALLBACK = 'Your car.\nYour rules.\nDrive your way.';
const HERO_SUBTITLE_FALLBACK =
  'Rent verified self-drive cars from trusted hosts across India. No driver. No restrictions. Just open roads.';

const TESTIMONIALS_FALLBACK: Testimonial[] = [
  { name: 'Ananya R.', quote: 'Booked a Creta for a weekend trip to Coorg — spotless car, host was super responsive.', rating: 5 },
  { name: 'Vikram S.', quote: "I've listed my Swift on Ziyam for 8 months now. The N+1 payouts land like clockwork.", rating: 5 },
  { name: 'Fatima K.', quote: 'KYC took two minutes, car was delivered to my apartment. Great experience overall.', rating: 4 },
];

export default function HomePage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const { scrollY } = useScroll();
  const heroParallaxY = useTransform(scrollY, [0, 700], [0, 180]);
  const heroContentOpacity = useTransform(scrollY, [0, 500], [1, 0.2]);

  const [heroTitle, setHeroTitle] = useState(HERO_TITLE_FALLBACK);
  const [heroSubtitle, setHeroSubtitle] = useState(HERO_SUBTITLE_FALLBACK);
  const [trustBadges, setTrustBadges] = useState<TrustBadge[]>(TRUST_BADGES_FALLBACK);
  const [categories, setCategories] = useState<CategoryDef[]>(CATEGORIES_FALLBACK);
  const [cities, setCities] = useState<CityDef[]>(CITIES_FALLBACK);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(TESTIMONIALS_FALLBACK);

  useEffect(() => {
    let active = true;
    carsApi
      .list({ availableOnly: true, sort: 'featured' })
      .then((res) => {
        if (active) setCars(res.data.slice(0, 6));
      })
      .catch((err) => console.error('Failed to load featured cars', err))
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

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{
            y: heroParallaxY,
            scale: 1.15,
            backgroundImage:
              'linear-gradient(to bottom right, rgba(0,0,0,0.65), rgba(0,0,0,0.45)), url(https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&q=80)',
          }}
        />

        <motion.div
          className="relative max-w-5xl mx-auto px-4 pt-24 pb-16 w-full"
          style={{ opacity: heroContentOpacity }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <motion.div
            className="mb-4 inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/40 rounded-full px-4 py-1.5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest">
              India's #1 P2P Self-Drive Platform
            </span>
          </motion.div>
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight mb-4 whitespace-pre-line"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            {heroTitle}
          </motion.h1>
          <motion.p
            className="text-gray-300 text-lg mb-10 max-w-xl"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.32 }}
          >
            {heroSubtitle}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.42 }}>
            <SearchBar />
          </motion.div>
        </motion.div>

        {/* Trust badges */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {trustBadges.map((b, i) => (
              <motion.div
                key={b.label}
                className="text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.08 }}
              >
                <div className="text-2xl font-extrabold text-amber-400">{b.label}</div>
                <div className="text-xs text-gray-300">{b.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BROWSE BY CATEGORY ───────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Browse by Category</h2>
            <p className="text-gray-500 text-sm mb-8">From budget hatchbacks to luxury cruisers</p>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <StaggerItem key={cat.label}>
                <motion.a
                  href={`/cars?category=${cat.label}`}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-amber-400 hover:bg-amber-50 transition-colors group"
                >
                  <motion.span whileHover={{ scale: 1.2, rotate: 6 }} transition={{ type: 'spring', stiffness: 300 }} className="text-3xl">
                    {cat.icon}
                  </motion.span>
                  <span className="text-sm font-semibold text-gray-800 group-hover:text-amber-600">{cat.label}</span>
                  <span className="text-xs text-gray-400 text-center">{cat.desc}</span>
                </motion.a>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ── TOP CITIES ───────────────────────────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Top Cities</h2>
            <p className="text-gray-500 text-sm mb-8">Self-drive rentals available across India</p>
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

      {/* ── FEATURED CARS ─────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <ScrollReveal>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Featured Cars</h2>
                <p className="text-gray-500 text-sm">Top-rated picks across India</p>
              </div>
              <a href="/cars" className="text-amber-500 hover:text-amber-600 text-sm font-semibold transition">
                View all →
              </a>
            </div>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <CarCardSkeleton key={i} />)
              : cars.length === 0
              ? (
                <p className="col-span-full text-center text-gray-400 py-10">
                  No cars available yet — check back soon.
                </p>
              )
              : cars.map((car) => (
                <StaggerItem key={car.id}>
                  <motion.div whileHover={{ y: -6 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }}>
                    <CarCard car={car} />
                  </motion.div>
                </StaggerItem>
              ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">What Our Community Says</h2>
            <p className="text-gray-500 text-sm mb-10 text-center">Real feedback from renters and hosts</p>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <StaggerItem key={i}>
                <motion.div
                  whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.12)' }}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full"
                >
                  <div className="text-amber-400 mb-3">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</div>
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

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="py-20 bg-gray-950 text-white">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-3xl font-extrabold mb-2">How ZiyamSelfDrive Works</h2>
            <p className="text-gray-400 mb-12">Rent a car in 4 simple steps</p>
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
                    className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl"
                  >
                    {step.icon}
                  </motion.div>
                  <div className="text-xs text-amber-400 font-bold uppercase tracking-widest mb-1">Step {i + 1}</div>
                  <h3 className="font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{step.desc}</p>
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

      {/* ── LIST YOUR CAR CTA ─────────────────────────────────────── */}
      <section className="py-20 bg-amber-500">
        <ScrollReveal className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-3xl font-extrabold text-white mb-2">Earn ₹30,000+ a month</h2>
            <p className="text-amber-100 max-w-md">
              List your car on ZiyamSelfDrive and earn passive income. You keep 70% of every booking. We
              handle marketing, insurance, and payments.
            </p>
          </div>
          <MotionButton
            href="/host/onboarding"
            className="bg-white text-amber-600 hover:bg-amber-50 font-bold px-8 py-4 rounded-xl transition-colors text-nowrap shadow-lg"
          >
            Start Earning →
          </MotionButton>
        </ScrollReveal>
      </section>

      {/* ── APP DOWNLOAD ─────────────────────────────────────────── */}
      <section className="py-16 bg-gray-900 text-white">
        <ScrollReveal className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1">
            <h2 className="text-3xl font-extrabold mb-3">Download the Ziyam App</h2>
            <p className="text-gray-400 mb-6">
              Book, track, and manage your rentals on the go. Available on iOS and Android.
            </p>
            <div className="flex gap-4">
              <MotionButton
                href="#"
                className="flex items-center gap-2 bg-white text-gray-900 font-semibold px-5 py-3 rounded-xl hover:bg-gray-100 transition-colors text-sm"
              >
                <span className="text-xl">🍎</span> App Store
              </MotionButton>
              <MotionButton
                href="#"
                className="flex items-center gap-2 bg-white text-gray-900 font-semibold px-5 py-3 rounded-xl hover:bg-gray-100 transition-colors text-sm"
              >
                <span className="text-xl">▶</span> Google Play
              </MotionButton>
            </div>
          </div>
          <div className="flex-1 text-center">
            <motion.div
              whileHover={{ rotate: 2, scale: 1.03 }}
              className="inline-block bg-gray-800 rounded-3xl p-8 border border-gray-700"
            >
              <span className="text-6xl">📱</span>
              <p className="text-gray-400 text-sm mt-3">Scan QR to download</p>
              <div className="w-20 h-20 bg-gray-700 rounded-lg mx-auto mt-3 flex items-center justify-center text-xs text-gray-500">
                QR Code
              </div>
            </motion.div>
          </div>
        </ScrollReveal>
      </section>

      <Footer />
    </div>
  );
}
