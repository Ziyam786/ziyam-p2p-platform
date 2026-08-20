'use client';

import React, { useEffect, useRef, useState } from 'react';
import { planApi } from '../lib/api';

const DEBOUNCE_MS = 500;

export interface ResolvedDestination {
  placeName: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

export default function PlanDestinationInput({ onResolved }: { onResolved: (result: ResolvedDestination | null) => void }) {
  const [query, setQuery] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setError(null);
    onResolved(null);
    if (!query.trim()) return;

    timerRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await planApi.destinationCheck(query.trim());
        if (res.data.valid) {
          onResolved({
            placeName: res.data.placeName!,
            lat: res.data.lat!,
            lng: res.data.lng!,
            distanceKm: res.data.distanceKm!,
          });
        } else {
          setError(res.data.reason ?? 'Could not check that destination.');
        }
      } catch {
        setError('Could not check that destination right now — try again.');
      } finally {
        setChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">Where do you want to drive to?</label>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Hampi, Wayanad, Pondicherry…"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {checking && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">Checking…</span>}
      </div>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  );
}
