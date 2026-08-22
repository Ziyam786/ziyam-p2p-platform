'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import SearchBar from '../../components/SearchBar';
import CarCard from '../../components/CarCard';
import Modal from '../../components/Modal';
import { CarCardSkeleton } from '../../components/Skeleton';
import { carsApi, settingsApi } from '../../lib/api';
import type { Car } from '../../lib/types';

const CATEGORIES_FALLBACK = ['All', 'Hatchback', 'Sedan', 'SUV', 'Luxury', 'EV', 'MUV'];
const TRANSMISSIONS = ['All', 'Manual', 'Automatic'];
const FUEL_TYPES = ['All', 'Petrol', 'Diesel', 'Electric', 'CNG'];
const SORT_OPTIONS = [
  { label: 'Newest', value: 'relevance' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Top Rated', value: 'rating' },
];

// Curated shortcuts onto the same sort options above — a friendlier browsing
// entry point than the raw dropdown, not a new dimension of data.
const BROWSE_LENSES = [
  { label: 'All', icon: '', sort: 'relevance' },
  { label: 'Trending', icon: '🔥', sort: 'rating' },
  { label: 'Premium', icon: '💎', sort: 'price_desc' },
  { label: 'Budget', icon: '💰', sort: 'price_asc' },
];

function CarsPageInner() {
  const searchParams = useSearchParams();

  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [city, setCity] = useState(searchParams.get('city') ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? 'All');
  const [transmission, setTransmission] = useState('All');
  const [fuel, setFuel] = useState('All');
  const [maxPrice, setMaxPrice] = useState(10000);
  const [sortBy, setSortBy] = useState('relevance');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [categories, setCategories] = useState<string[]>(CATEGORIES_FALLBACK);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    settingsApi
      .public()
      .then((res) => {
        if (res.data.categories?.length) setCategories(['All', ...res.data.categories.map((c) => c.label)]);
      })
      .catch(() => {
        // Keep the hardcoded fallback.
      });
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    carsApi
      .list({
        city: city || undefined,
        category: category !== 'All' ? category : undefined,
        transmission: transmission !== 'All' ? transmission : undefined,
        fuelType: fuel !== 'All' ? fuel : undefined,
        maxPrice,
        availableOnly: showAvailableOnly || undefined,
        sort: sortBy !== 'relevance' ? sortBy : undefined,
      })
      .then((res) => active && setCars(res.data))
      .catch((err) => active && setError(err.message ?? 'Failed to load cars'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [city, category, transmission, fuel, maxPrice, sortBy, showAvailableOnly]);

  function clearFilters() {
    setCity('');
    setCategory('All');
    setTransmission('All');
    setFuel('All');
    setMaxPrice(10000);
    setShowAvailableOnly(false);
  }

  const hasActiveFilters = useMemo(
    () => city || category !== 'All' || transmission !== 'All' || fuel !== 'All' || maxPrice !== 10000 || showAvailableOnly,
    [city, category, transmission, fuel, maxPrice, showAvailableOnly]
  );

  const filterPanel = (
    <div className="space-y-7">
      {/* Category */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Category</h3>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                      category === c
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Transmission */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Transmission</h3>
              <div className="flex flex-wrap gap-2">
                {TRANSMISSIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTransmission(t)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                      transmission === t
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Fuel type */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Fuel Type</h3>
              <div className="flex flex-wrap gap-2">
                {FUEL_TYPES.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFuel(f)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                      fuel === f
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-600'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Price range */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Max Price: <span className="text-amber-500">₹{maxPrice.toLocaleString()}/day</span>
              </h3>
              <input
                type="range"
                min={500}
                max={10000}
                step={100}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>₹500</span>
                <span>₹10,000</span>
              </div>
            </div>

            {/* Available only */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAvailableOnly}
                onChange={(e) => setShowAvailableOnly(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-sm text-gray-700">Available cars only</span>
            </label>

      {hasActiveFilters && (
        <button onClick={clearFilters} className="w-full text-xs text-red-400 hover:text-red-500 text-center py-2 transition">
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      {/* Search bar strip */}
      <div className="bg-gray-900 pt-20 pb-6 px-4">
        <div className="max-w-5xl mx-auto">
          <SearchBar compact />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* ── FILTERS SIDEBAR (desktop) ───────────────────────── */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-24">
            <h2 className="font-bold text-gray-900 text-lg mb-5">Filters</h2>
            {filterPanel}
          </div>
        </aside>

        {/* ── CAR GRID ─────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          <button
            onClick={() => setShowMobileFilters(true)}
            className="lg:hidden mb-5 flex items-center gap-2 px-4 py-2 text-sm rounded-full font-semibold border border-gray-200 bg-white text-gray-700"
          >
            ⚙️ Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-amber-500" />}
          </button>

          <div className="flex flex-wrap gap-2 mb-5">
            {BROWSE_LENSES.map((lens) => (
              <button
                key={lens.label}
                onClick={() => setSortBy(lens.sort)}
                className={`px-4 py-2 text-sm rounded-full font-semibold transition ${
                  sortBy === lens.sort
                    ? 'bg-amber-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600'
                }`}
              >
                {lens.icon && <span className="mr-1">{lens.icon}</span>}
                {lens.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-500">
              <span className="font-bold text-gray-900">{loading ? '…' : cars.length}</span> cars found
              {city && <span> in <span className="font-semibold text-gray-700">{city}</span></span>}
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-700 bg-white"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <CarCardSkeleton key={i} />)}
            </div>
          ) : cars.length === 0 ? (
            <div className="text-center py-24">
              <span className="text-5xl mb-4 block">🚗</span>
              <p className="text-gray-500">No cars match your filters.</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-4 text-amber-500 underline text-sm">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {cars.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          )}
        </main>
      </div>

      <Modal open={showMobileFilters} onClose={() => setShowMobileFilters(false)} title="Filters">
        {filterPanel}
      </Modal>

      <Footer />
    </div>
  );
}

export default function CarsPage() {
  return (
    <Suspense fallback={null}>
      <CarsPageInner />
    </Suspense>
  );
}
