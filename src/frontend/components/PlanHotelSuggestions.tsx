'use client';

import React, { useEffect, useState } from 'react';
import { planApi, type HotelSuggestion } from '../lib/api';

const PRICE_LEVEL_LABEL: Record<number, string> = { 0: 'Free', 1: '₹', 2: '₹₹', 3: '₹₹₹', 4: '₹₹₹₹' };

export default function PlanHotelSuggestions({ lat, lng, onResolved }: { lat: number; lng: number; onResolved: (medianPriceLevel: number | null) => void }) {
  const [hotels, setHotels] = useState<HotelSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    planApi
      .hotels(lat, lng)
      .then((res) => {
        if (!active) return;
        setHotels(res.data);
        // Median across all returned hotels, not just the first (Places
        // ranks by prominence, not price — the first hotel's price level
        // alone can swing the headline "Total estimate" ~6x vs. the 6
        // hotels actually shown below it).
        const priceLevels = res.data
          .map((h) => h.priceLevel)
          .filter((p): p is number => p != null)
          .sort((a, b) => a - b);
        let medianPriceLevel: number | null = null;
        if (priceLevels.length > 0) {
          const mid = Math.floor(priceLevels.length / 2);
          medianPriceLevel =
            priceLevels.length % 2 === 0 ? Math.round((priceLevels[mid - 1] + priceLevels[mid]) / 2) : priceLevels[mid];
        }
        onResolved(medianPriceLevel);
      })
      .catch(() => {
        if (active) onResolved(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  if (loading) return <p className="text-sm text-gray-400">Finding places to stay…</p>;
  if (hotels.length === 0) return <p className="text-sm text-gray-500">Hotel suggestions unavailable right now.</p>;

  return (
    <div className="space-y-2">
      {hotels.map((h) => (
        <div key={h.name} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{h.name}</p>
            <p className="text-xs text-gray-400 truncate">{h.address}</p>
          </div>
          <div className="text-right shrink-0">
            {h.rating != null && <p className="text-sm text-amber-500 font-bold">★ {h.rating.toFixed(1)}</p>}
            {h.priceLevel != null && <p className="text-xs text-gray-400">{PRICE_LEVEL_LABEL[h.priceLevel] ?? ''}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
