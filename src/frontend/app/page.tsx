'use client';

import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SearchBar from '../components/SearchBar';
import CarCard, { Car } from '../components/CarCard';

/* ── Mock data – replace with API calls ─────────────────────────── */
const FEATURED_CARS: Car[] = [
  {
    id: 'c1',
    make: 'Maruti',
    model: 'Swift',
    year: 2022,
    category: 'Hatchback',
    transmission: 'Manual',
    fuelType: 'Petrol',
    seats: 5,
    pricePerDay: 1199,
    rating: 4.5,
    reviewCount: 382,
    imageUrl: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/159099/swift-exterior-right-front-three-quarter-6.jpeg',
    city: 'Bengaluru',
    available: true,
    kmIncluded: 300,
    extraKmCharge: 8,
  },
  {
    id: 'c2',
    make: 'Hyundai',
    model: 'Creta',
    year: 2023,
    category: 'SUV',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seats: 5,
    pricePerDay: 2499,
    rating: 4.7,
    reviewCount: 219,
    imageUrl: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/106815/creta-exterior-right-front-three-quarter-4.jpeg',
    city: 'Mumbai',
    available: true,
    kmIncluded: 300,
    extraKmCharge: 12,
  },
  {
    id: 'c3',
    make: 'Tata',
    model: 'Nexon EV',
    year: 2023,
    category: 'EV',
    transmission: 'Automatic',
    fuelType: 'Electric',
    seats: 5,
    pricePerDay: 2799,
    rating: 4.6,
    reviewCount: 145,
    imageUrl: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/156811/nexon-ev-exterior-right-front-three-quarter-2.jpeg',
    city: 'Delhi NCR',
    available: true,
    kmIncluded: 250,
    extraKmCharge: 14,
  },
];

const CITIES = [
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

const TRUST_BADGES = [
  { label: '1 Lakh+', sub: 'Happy Renters' },
  { label: '5,000+', sub: 'Verified Cars' },
  { label: '30+ Cities', sub: 'Pan-India' },
  { label: '4.6 ★', sub: 'Average Rating' },
];

const CATEGORIES = [
  { label: 'Hatchback', icon: '🚘', desc: 'Compact & affordable' },
  { label: 'Sedan', icon: '🚗', desc: 'Comfortable & stylish' },
  { label: 'SUV', icon: '🛻', desc: 'Space for the family' },
  { label: 'Luxury', icon: '🏎️', desc: 'Premium experience' },
  { label: 'EV', icon: '⚡', desc: 'Zero-emission trips' },
  { label: 'MUV', icon: '🚐', desc: 'Group travel' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col justify-center bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(to bottom right, rgba(0,0,0,0.65), rgba(0,0,0,0.45)), url(https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&q=80)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 pt-24 pb-16 w-full">
          <div className="mb-4 inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/40 rounded-full px-4 py-1.5">
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest">
              India's #1 P2P Self-Drive Platform
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight mb-4">
            Your car. <br />
            <span className="text-amber-400">Your rules.</span> <br />
            Drive your way.
          </h1>
          <p className="text-gray-300 text-lg mb-10 max-w-xl">
            Rent verified self-drive cars from trusted hosts across India. No driver. No restrictions.
            Just open roads.
          </p>
          <SearchBar />
        </div>

        {/* Trust badges */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {TRUST_BADGES.map((b) => (
              <div key={b.label} className="text-center">
                <div className="text-2xl font-extrabold text-amber-400">{b.label}</div>
                <div className="text-xs text-gray-300">{b.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BROWSE BY CATEGORY ───────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Browse by Category</h2>
          <p className="text-gray-500 text-sm mb-8">From budget hatchbacks to luxury cruisers</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {CATEGORIES.map((cat) => (
              <a
                key={cat.label}
                href={`/cars?category=${cat.label}`}
                className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-amber-400 hover:bg-amber-50 transition group"
              >
                <span className="text-3xl">{cat.icon}</span>
                <span className="text-sm font-semibold text-gray-800 group-hover:text-amber-600">{cat.label}</span>
                <span className="text-xs text-gray-400 text-center">{cat.desc}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOP CITIES ───────────────────────────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Top Cities</h2>
          <p className="text-gray-500 text-sm mb-8">Self-drive rentals available across India</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {CITIES.map((c) => (
              <a
                key={c.name}
                href={`/cars?city=${c.name}`}
                className="flex flex-col items-center gap-2 p-5 bg-white rounded-2xl shadow-sm hover:shadow-md hover:border-amber-400 border border-gray-100 transition text-center"
              >
                <span className="text-3xl">{c.emoji}</span>
                <span className="text-sm font-semibold text-gray-800">{c.name}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED CARS ─────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Featured Cars</h2>
              <p className="text-gray-500 text-sm">Top-rated picks across India</p>
            </div>
            <a href="/cars" className="text-amber-500 hover:text-amber-600 text-sm font-semibold transition">
              View all →
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURED_CARS.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="py-20 bg-gray-950 text-white">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-extrabold mb-2">How ZiyamSelfDrive Works</h2>
          <p className="text-gray-400 mb-12">Rent a car in 4 simple steps</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {HOW_STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                {i < HOW_STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-amber-500/30 -translate-x-1/2" />
                )}
                <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                  {step.icon}
                </div>
                <div className="text-xs text-amber-400 font-bold uppercase tracking-widest mb-1">Step {i + 1}</div>
                <h3 className="font-bold text-white mb-2">{step.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <a
            href="/how-it-works"
            className="inline-block mt-12 border border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-white text-sm font-semibold px-8 py-3 rounded-xl transition"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* ── LIST YOUR CAR CTA ─────────────────────────────────────── */}
      <section className="py-20 bg-amber-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-3xl font-extrabold text-white mb-2">Earn ₹30,000+ a month</h2>
            <p className="text-amber-100 max-w-md">
              List your car on ZiyamSelfDrive and earn passive income. You keep 70% of every booking. We
              handle marketing, insurance, and payments.
            </p>
          </div>
          <a
            href="/host/dashboard"
            className="bg-white text-amber-600 hover:bg-amber-50 font-bold px-8 py-4 rounded-xl transition text-nowrap shadow-lg"
          >
            Start Earning →
          </a>
        </div>
      </section>

      {/* ── APP DOWNLOAD ─────────────────────────────────────────── */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1">
            <h2 className="text-3xl font-extrabold mb-3">Download the Ziyam App</h2>
            <p className="text-gray-400 mb-6">
              Book, track, and manage your rentals on the go. Available on iOS and Android.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="flex items-center gap-2 bg-white text-gray-900 font-semibold px-5 py-3 rounded-xl hover:bg-gray-100 transition text-sm"
              >
                <span className="text-xl">🍎</span> App Store
              </a>
              <a
                href="#"
                className="flex items-center gap-2 bg-white text-gray-900 font-semibold px-5 py-3 rounded-xl hover:bg-gray-100 transition text-sm"
              >
                <span className="text-xl">▶</span> Google Play
              </a>
            </div>
          </div>
          <div className="flex-1 text-center">
            <div className="inline-block bg-gray-800 rounded-3xl p-8 border border-gray-700">
              <span className="text-6xl">📱</span>
              <p className="text-gray-400 text-sm mt-3">Scan QR to download</p>
              <div className="w-20 h-20 bg-gray-700 rounded-lg mx-auto mt-3 flex items-center justify-center text-xs text-gray-500">
                QR Code
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
