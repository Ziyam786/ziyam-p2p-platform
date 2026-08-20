'use client';

import React, { useEffect, useState } from 'react';
import { settingsApi } from '../lib/api';
import { estimateTripPrice, defaultTripDays } from '../lib/tripPriceEstimate';

export default function PlanPriceEstimate({
  dailyRate,
  distanceKm,
  hotelPriceLevel,
  onDaysChange,
}: {
  dailyRate: number;
  distanceKm: number;
  hotelPriceLevel: number | null;
  onDaysChange?: (days: number) => void;
}) {
  const [days, setDays] = useState(() => defaultTripDays(distanceKm));
  const [fuelPricePerLitre, setFuelPricePerLitre] = useState(105);

  useEffect(() => {
    settingsApi
      .public()
      .then((res) => setFuelPricePerLitre(res.data.fuel_price_per_litre))
      .catch(() => {});
  }, []);

  useEffect(() => {
    onDaysChange?.(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const estimate = estimateTripPrice({ dailyRate, days, distanceKm, hotelPriceLevel, nights: Math.max(0, days - 1) }, fuelPricePerLitre);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Estimated trip cost</p>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Days
          <input
            type="number"
            min={1}
            max={14}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(14, Number(e.target.value) || 1)))}
            className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
          />
        </label>
      </div>
      <div className="space-y-1 text-sm text-gray-600">
        <div className="flex justify-between"><span>Car rental ({days} {days === 1 ? 'day' : 'days'})</span><span>₹{estimate.rentalCost.toLocaleString('en-IN')}</span></div>
        <div className="flex justify-between"><span>Fuel (round trip)</span><span>₹{estimate.fuelCost.toLocaleString('en-IN')}</span></div>
        <div className="flex justify-between"><span>Tolls (estimate)</span><span>₹{estimate.tollCost.toLocaleString('en-IN')}</span></div>
        {estimate.stayCost != null && (
          <div className="flex justify-between"><span>Stay ({Math.max(0, days - 1)} nights)</span><span>₹{estimate.stayCost.toLocaleString('en-IN')}</span></div>
        )}
      </div>
      <div className="flex justify-between font-bold text-gray-900 text-lg border-t border-gray-100 mt-3 pt-3">
        <span>Total estimate</span><span>₹{estimate.total.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
}
