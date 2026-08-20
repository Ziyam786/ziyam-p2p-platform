'use client';

import React, { useEffect, useState } from 'react';
import { planApi, type PlanCar } from '../lib/api';

export default function PlanCarSuggestion({ distanceKm, onResolved }: { distanceKm: number; onResolved: (car: PlanCar | null) => void }) {
  const [car, setCar] = useState<PlanCar | null>(null);
  const [exactMatch, setExactMatch] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    planApi
      .suggestCar(distanceKm)
      .then((res) => {
        if (!active) return;
        setCar(res.data.car);
        setExactMatch(res.data.exactMatch);
        onResolved(res.data.car);
      })
      .catch(() => {
        if (active) onResolved(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distanceKm]);

  if (loading) return <p className="text-sm text-gray-400">Finding a car for this trip…</p>;
  if (!car) return <p className="text-sm text-gray-500">No cars available right now — check back shortly.</p>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1">
        {exactMatch ? 'Suggested for this trip' : 'Best available (no exact match for this trip)'}
      </p>
      <h3 className="font-bold text-gray-900 text-lg">{car.make} {car.model}</h3>
      <p className="text-sm text-gray-500 mt-1">{car.category} · {car.seats} seats · {car.transmission} · {car.fuelType}</p>
      <p className="text-amber-500 font-extrabold text-xl mt-2">₹{car.dailyRate.toLocaleString('en-IN')}<span className="text-sm text-gray-400 font-normal">/day</span></p>
    </div>
  );
}
