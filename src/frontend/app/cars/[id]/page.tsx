'use client';

import React, { useState, useMemo } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { Car } from '../../../components/CarCard';

/* ── Mock car data for the detail page ─────────────────────────── */
const MOCK_CAR: Car & {
  description: string;
  features: string[];
  pickupAddress: string;
  hostName: string;
  hostRating: number;
  hostTrips: number;
} = {
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
  description:
    'A well-maintained 2022 Maruti Swift in excellent condition. Perfect for city drives and weekend getaways. Non-smoking, pet-free. AC fully functional. Music system with Bluetooth.',
  features: [
    'Air Conditioning',
    'Bluetooth / Aux',
    'Power Steering',
    'Central Locking',
    'Reverse Camera',
    'USB Charging',
    'First Aid Kit',
    'Spare Tyre',
  ],
  pickupAddress: 'Koramangala 5th Block, Bengaluru — 560095',
  hostName: 'Ravi Kumar',
  hostRating: 4.8,
  hostTrips: 214,
};

const INCLUDED_ITEMS = [
  { icon: '🛣️', label: '300 km/day included' },
  { icon: '⛽', label: 'Fuel not included' },
  { icon: '🛡️', label: 'Basic insurance' },
  { icon: '📞', label: '24/7 roadside support' },
];

export default function CarDetailPage({ params }: { params: { id: string } }) {
  const car = MOCK_CAR; // In production: fetch by params.id
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [activeImg, setActiveImg] = useState(car.imageUrl);

  const days = useMemo(() => {
    if (!pickup || !dropoff) return 0;
    const diff = new Date(dropoff).getTime() - new Date(pickup).getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [pickup, dropoff]);

  const baseFare = days * car.pricePerDay;
  const platformFee = Math.round(baseFare * 0.08);
  const securityDeposit = 2000;
  const total = baseFare + platformFee + securityDeposit;

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
            <div className="rounded-2xl overflow-hidden h-72 md:h-96 bg-gray-200">
              <img src={activeImg} alt={`${car.make} ${car.model}`} className="w-full h-full object-cover" />
            </div>

            {/* Thumbnails (single source mock) */}
            <div className="flex gap-3">
              {[car.imageUrl, car.imageUrl, car.imageUrl].map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(img)}
                  className={`w-20 h-14 rounded-xl overflow-hidden border-2 transition ${
                    activeImg === img ? 'border-amber-500' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Car title */}
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-extrabold text-gray-900">
                  {car.make} {car.model} {car.year}
                </h1>
                <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {car.category}
                </span>
                {car.available ? (
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    Available
                  </span>
                ) : (
                  <span className="bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    Booked
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-1">📍 {car.city}</p>

              {/* Rating */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-amber-400 font-bold">★ {car.rating.toFixed(1)}</span>
                <span className="text-gray-500 text-sm">({car.reviewCount} reviews)</span>
              </div>
            </div>

            {/* Specs chips */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: '🔧', label: car.transmission },
                { icon: '⛽', label: car.fuelType },
                { icon: '💺', label: `${car.seats} Seats` },
                { icon: '🛣️', label: `${car.kmIncluded} km/day` },
                { icon: '➕', label: `₹${car.extraKmCharge}/extra km` },
              ].map((s) => (
                <span
                  key={s.label}
                  className="bg-gray-100 text-gray-700 text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5"
                >
                  {s.icon} {s.label}
                </span>
              ))}
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-2">About this car</h2>
              <p className="text-gray-600 text-sm leading-relaxed">{car.description}</p>
            </div>

            {/* Features */}
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

            {/* What's included */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4">What's Included</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {INCLUDED_ITEMS.map((item) => (
                  <div key={item.label} className="flex flex-col items-center text-center gap-1">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-xs text-gray-600">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Host info */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
                👤
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Hosted by</p>
                <p className="font-bold text-gray-900">{car.hostName}</p>
                <p className="text-xs text-gray-500">
                  ★ {car.hostRating.toFixed(1)} · {car.hostTrips} trips
                </p>
              </div>
            </div>

            {/* Pickup location */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-2">Pickup Location</h2>
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <span className="text-amber-500">📍</span> {car.pickupAddress}
              </p>
              <div className="mt-3 h-36 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">
                Map preview (Google Maps embed)
              </div>
            </div>
          </div>

          {/* ── RIGHT: Booking card ────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-5">
              <div>
                <span className="text-3xl font-extrabold text-amber-500">₹{car.pricePerDay.toLocaleString()}</span>
                <span className="text-gray-400 text-sm">/day</span>
              </div>

              <hr className="border-gray-100" />

              {/* Date pickers */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Pickup Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={pickup}
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
                  onChange={(e) => setDropoff(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Fare breakdown */}
              {days > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-700">
                    <span>₹{car.pricePerDay.toLocaleString()} × {days} day{days > 1 ? 's' : ''}</span>
                    <span>₹{baseFare.toLocaleString()}</span>
                  </div>
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

              <button
                disabled={!car.available || days === 0}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition text-base"
              >
                {!car.available ? 'Car Unavailable' : days === 0 ? 'Select Dates to Book' : 'Proceed to Book'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                You won't be charged yet. Review before confirming.
              </p>

              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                <span>🔒 Secure Payment</span>
                <span>·</span>
                <span>🛡️ Insurance Covered</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
