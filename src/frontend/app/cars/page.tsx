'use client';

import React, { useState, useMemo } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import SearchBar from '../../components/SearchBar';
import CarCard, { Car } from '../../components/CarCard';

/* ── Mock catalogue – replace with API fetch ───────────────────── */
const ALL_CARS: Car[] = [
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
  {
    id: 'c4',
    make: 'Honda',
    model: 'City',
    year: 2021,
    category: 'Sedan',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seats: 5,
    pricePerDay: 1899,
    rating: 4.4,
    reviewCount: 167,
    imageUrl: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/134287/city-exterior-right-front-three-quarter-11.jpeg',
    city: 'Hyderabad',
    available: false,
    kmIncluded: 300,
    extraKmCharge: 10,
  },
  {
    id: 'c5',
    make: 'Mercedes',
    model: 'GLA 200',
    year: 2023,
    category: 'Luxury',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seats: 5,
    pricePerDay: 8999,
    rating: 4.9,
    reviewCount: 42,
    imageUrl: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/130591/gla-exterior-right-front-three-quarter-2.jpeg',
    city: 'Bengaluru',
    available: true,
    kmIncluded: 200,
    extraKmCharge: 30,
  },
  {
    id: 'c6',
    make: 'Toyota',
    model: 'Innova Crysta',
    year: 2022,
    category: 'MUV',
    transmission: 'Manual',
    fuelType: 'Diesel',
    seats: 7,
    pricePerDay: 3499,
    rating: 4.5,
    reviewCount: 198,
    imageUrl: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/40087/innova-crysta-exterior-right-front-three-quarter-5.jpeg',
    city: 'Chennai',
    available: true,
    kmIncluded: 350,
    extraKmCharge: 15,
  },
];

const CATEGORIES = ['All', 'Hatchback', 'Sedan', 'SUV', 'Luxury', 'EV', 'MUV'];
const TRANSMISSIONS = ['All', 'Manual', 'Automatic'];
const FUEL_TYPES = ['All', 'Petrol', 'Diesel', 'Electric', 'CNG'];
const SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Top Rated', value: 'rating' },
];

export default function CarsPage() {
  const [city, setCity] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('city') ?? '';
  });
  const [category, setCategory] = useState('All');
  const [transmission, setTransmission] = useState('All');
  const [fuel, setFuel] = useState('All');
  const [maxPrice, setMaxPrice] = useState(10000);
  const [sortBy, setSortBy] = useState('relevance');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  const filtered = useMemo(() => {
    let cars = ALL_CARS.filter((c) => {
      if (city && c.city !== city) return false;
      if (category !== 'All' && c.category !== category) return false;
      if (transmission !== 'All' && c.transmission !== transmission) return false;
      if (fuel !== 'All' && c.fuelType !== fuel) return false;
      if (c.pricePerDay > maxPrice) return false;
      if (showAvailableOnly && !c.available) return false;
      return true;
    });

    if (sortBy === 'price_asc') cars = [...cars].sort((a, b) => a.pricePerDay - b.pricePerDay);
    else if (sortBy === 'price_desc') cars = [...cars].sort((a, b) => b.pricePerDay - a.pricePerDay);
    else if (sortBy === 'rating') cars = [...cars].sort((a, b) => b.rating - a.rating);

    return cars;
  }, [city, category, transmission, fuel, maxPrice, sortBy, showAvailableOnly]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      {/* Search bar strip */}
      <div className="bg-gray-900 pt-20 pb-6 px-4">
        <div className="max-w-5xl mx-auto">
          <SearchBar compact onSearch={({ city: selectedCity }) => setCity(selectedCity)} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* ── FILTERS SIDEBAR ──────────────────────────────────── */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-24 space-y-7">
            <h2 className="font-bold text-gray-900 text-lg">Filters</h2>

            {/* Category */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Category</h3>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
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

            <button
              onClick={() => {
                setCategory('All');
                setTransmission('All');
                setFuel('All');
                setMaxPrice(10000);
                setShowAvailableOnly(false);
              }}
              className="w-full text-xs text-red-400 hover:text-red-500 text-center py-2 transition"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        {/* ── CAR GRID ─────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-500">
              <span className="font-bold text-gray-900">{filtered.length}</span> cars found
              {city && <> in <span className="font-semibold text-gray-700">{city}</span></>}
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

          {filtered.length === 0 ? (
            <div className="text-center py-24">
              <span className="text-5xl mb-4 block">🚗</span>
              <p className="text-gray-500">No cars match your filters.</p>
              <button
                onClick={() => {
                  setCategory('All');
                  setTransmission('All');
                  setFuel('All');
                  setMaxPrice(10000);
                  setShowAvailableOnly(false);
                }}
                className="mt-4 text-amber-500 underline text-sm"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
