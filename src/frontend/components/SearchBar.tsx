'use client';

import React, { useState } from 'react';

const CITIES = [
  'Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai',
  'Pune', 'Kolkata', 'Jaipur', 'Ahmedabad', 'Kochi',
];

interface SearchBarProps {
  onSearch?: (params: { city: string; pickup: string; dropoff: string }) => void;
  compact?: boolean;
}

export default function SearchBar({ onSearch, compact = false }: SearchBarProps) {
  const [city, setCity] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (onSearch) {
      onSearch({ city, pickup, dropoff });
    } else {
      const params = new URLSearchParams({ city, pickup, dropoff });
      window.location.href = `/cars?${params.toString()}`;
    }
  }

  const inputCls = compact
    ? 'text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 bg-white w-full'
    : 'text-sm px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 bg-white w-full';

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white ${compact ? 'rounded-xl p-3 gap-2' : 'rounded-2xl p-4 md:p-6 gap-4'} shadow-2xl flex flex-col md:flex-row items-end`}
    >
      {/* City */}
      <div className="flex-1 min-w-0">
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">City</label>
        <select value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} required>
          <option value="">Select city</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Pickup datetime */}
      <div className="flex-1 min-w-0">
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Pickup</label>
        <input
          type="datetime-local"
          value={pickup}
          onChange={(e) => setPickup(e.target.value)}
          className={inputCls}
          required
        />
      </div>

      {/* Drop-off datetime */}
      <div className="flex-1 min-w-0">
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Drop-off</label>
        <input
          type="datetime-local"
          value={dropoff}
          onChange={(e) => setDropoff(e.target.value)}
          className={inputCls}
          required
        />
      </div>

      <button
        type="submit"
        className={`btn-gradient text-white font-bold rounded-xl transition whitespace-nowrap ${compact ? 'px-5 py-2 text-sm' : 'px-8 py-3'}`}
      >
        Search Cars
      </button>
    </form>
  );
}
