'use client';

import React, { useEffect, useState } from 'react';
import { settingsApi } from '../lib/api';
import type { SmartPricing } from '../lib/types';

const FALLBACK: SmartPricing = {
  categoryHourlyRates: { Hatchback: 50, Sedan: 65, SUV: 85, Luxury: 150, EV: 70, MUV: 90 },
  cityMultipliers: { Bengaluru: 1 },
  defaultCityMultiplier: 1,
};

interface SmartPriceSliderProps {
  category: string;
  city: string;
  /** Stored as an equivalent daily rate (hourlyRate * 24) so the rest of the
   * app's booking-total math and displays keep working unchanged. */
  dailyRate: number;
  onChange: (dailyRate: number) => void;
  hostSharePercent?: number; // for the earnings breakdown, defaults to 0.7 (matches platform commission default)
}

/** Hosts can't type a price — only scroll this slider, capped between 5%
 * below and exactly at the computed market rate for the car's category/city.
 * Shows the live hourly rate, day-equivalent, and what the host actually earns. */
export default function SmartPriceSlider({ category, city, dailyRate, onChange, hostSharePercent = 0.7 }: SmartPriceSliderProps) {
  const [pricing, setPricing] = useState<SmartPricing>(FALLBACK);

  useEffect(() => {
    settingsApi
      .public()
      .then((res) => {
        if (res.data.smart_pricing) setPricing(res.data.smart_pricing);
      })
      .catch(() => {});
  }, []);

  const baseHourly = pricing.categoryHourlyRates[category] ?? 60;
  const multiplier = pricing.cityMultipliers[city] ?? pricing.defaultCityMultiplier ?? 1;
  const marketHourly = baseHourly * multiplier;
  const minHourly = Number((marketHourly * 0.95).toFixed(0));
  const maxHourly = Math.round(marketHourly);

  // dailyRate is the source of truth (what actually gets booked/billed); the
  // slider itself operates in hourly terms and converts both ways.
  const currentHourly = Math.min(maxHourly, Math.max(minHourly, Math.round(dailyRate / 24)));

  // If the category/city (and therefore the market band) changes such that
  // the stored rate falls outside the new [min, max], snap it back in range
  // rather than showing a slider position that doesn't match what's stored.
  useEffect(() => {
    const clamped = Math.min(maxHourly, Math.max(minHourly, Math.round(dailyRate / 24)));
    if (clamped * 24 !== dailyRate) onChange(clamped * 24);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minHourly, maxHourly]);

  function handleSlide(hourly: number) {
    onChange(hourly * 24);
  }

  const hostHourlyEarning = Math.round(currentHourly * hostSharePercent);

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Smart Price (scroll to adjust)</span>
        <span className="text-xs text-gray-400">Market rate: ₹{maxHourly}/hr</span>
      </div>
      <input
        type="range"
        min={minHourly}
        max={maxHourly}
        step={1}
        value={currentHourly}
        onChange={(e) => handleSlide(Number(e.target.value))}
        className="w-full accent-amber-500 my-2"
        aria-label="Adjust hourly price"
      />
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-extrabold text-gray-900">₹{currentHourly}<span className="text-sm font-medium text-gray-500">/hr</span></p>
          <p className="text-xs text-gray-500">≈ ₹{(currentHourly * 24).toLocaleString()}/day equivalent</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-emerald-600">₹{hostHourlyEarning}/hr</p>
          <p className="text-xs text-gray-400">your earnings breakout</p>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mt-2">
        Capped at market value ({maxHourly}/hr) down to 5% below ({minHourly}/hr) for {category} in {city || 'your city'} — set automatically, not editable by typing.
      </p>
    </div>
  );
}
