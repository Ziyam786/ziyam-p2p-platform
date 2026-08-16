'use client';

import React, { useEffect, useState } from 'react';
import { getStickyDates, setStickyDates } from '../lib/searchDates';
import { carsApi } from '../lib/api';

const CITIES = [
  'Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai',
  'Pune', 'Kolkata', 'Jaipur', 'Ahmedabad', 'Kochi',
];

interface SearchBarProps {
  onSearch?: (params: { city: string; pickup: string; dropoff: string }) => void;
  compact?: boolean;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Quick date-range presets — the "Today / This weekend / Next week" pattern common across self-drive rental sites, since typing two full datetimes by hand is the single biggest point of friction in a search form. */
const DATE_PRESETS: { label: string; range: () => [Date, Date] }[] = [
  {
    label: 'Today',
    range: () => {
      const start = new Date();
      start.setHours(start.getHours() + 1, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return [start, end];
    },
  },
  {
    label: 'This weekend',
    range: () => {
      const start = new Date();
      const daysUntilSat = (6 - start.getDay() + 7) % 7 || 7;
      start.setDate(start.getDate() + daysUntilSat);
      start.setHours(10, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 2);
      end.setHours(20, 0, 0, 0);
      return [start, end];
    },
  },
  {
    label: 'Next week',
    range: () => {
      const start = new Date();
      start.setDate(start.getDate() + 7);
      start.setHours(10, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 2);
      return [start, end];
    },
  },
];

export default function SearchBar({ onSearch, compact = false }: SearchBarProps) {
  const [city, setCity] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pulse, setPulse] = useState<{ availableCount: number; averageDailyRate: number | null } | null>(null);
  const [pulseLoading, setPulseLoading] = useState(false);

  // Pre-fill from whatever dates the renter last picked, so the search bar
  // itself stays "sticky" across pages too.
  useEffect(() => {
    const sticky = getStickyDates();
    if (sticky) {
      setPickup(sticky.pickup);
      setDropoff(sticky.dropoff);
    }
  }, []);

  // Live availability, scoped to whichever city is selected — real
  // aggregates from the backend, not a static "lots of cars!" claim.
  useEffect(() => {
    if (!city) {
      setPulse(null);
      return;
    }
    let active = true;
    setPulseLoading(true);
    carsApi
      .marketPulse(city)
      .then((res) => active && setPulse(res.data))
      .catch(() => active && setPulse(null))
      .finally(() => active && setPulseLoading(false));
    return () => {
      active = false;
    };
  }, [city]);

  function applyPreset(range: () => [Date, Date]) {
    const [start, end] = range();
    setPickup(toLocalInputValue(start));
    setDropoff(toLocalInputValue(end));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStickyDates(pickup, dropoff);
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
      className={`bg-white ${compact ? 'rounded-xl p-3 gap-2' : 'rounded-2xl p-4 md:p-6 gap-3'} shadow-2xl flex flex-col`}
    >
      {!compact && (
        <div className="flex gap-2 flex-wrap">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.range)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className={`flex flex-col md:flex-row items-end ${compact ? 'gap-2' : 'gap-4'}`}>
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
      </div>

      {!compact && city && (
        <p className="text-xs text-gray-500 -mt-1">
          {pulseLoading ? (
            'Checking availability…'
          ) : pulse && pulse.availableCount > 0 ? (
            <>
              <span className="text-emerald-600 font-semibold">{pulse.availableCount} car{pulse.availableCount === 1 ? '' : 's'} available</span> in {city}
              {pulse.averageDailyRate && <> · avg ₹{pulse.averageDailyRate.toLocaleString()}/day</>}
            </>
          ) : pulse ? (
            `No cars listed in ${city} yet — try another city.`
          ) : null}
        </p>
      )}
    </form>
  );
}
