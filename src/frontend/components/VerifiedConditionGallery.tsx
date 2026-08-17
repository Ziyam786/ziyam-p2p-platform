'use client';

import React, { useEffect, useState } from 'react';
import type { BookingConditionPhoto } from '../lib/types';
import { carsApi } from '../lib/api';

const ANGLE_LABELS: Record<string, string> = {
  FRONT: 'Front',
  REAR: 'Rear',
  LEFT: 'Left side',
  RIGHT: 'Right side',
  MIRROR_LEFT: 'Left mirror',
  MIRROR_RIGHT: 'Right mirror',
  ODOMETER: 'Odometer',
  OTHER: 'Other',
};

// Real drop-off photos from the car's most recently completed trip — not a
// 3D model. There's no photogrammetry/3D-scanning pipeline in this stack,
// and faking one from a handful of angle photos would be exactly the kind
// of claim this feature exists to avoid making. What's real: every trip
// already captures required condition photos at drop-off (see
// ConditionPhotoCapture.tsx) — this just surfaces the latest set publicly,
// before a guest books, instead of only after.
export default function VerifiedConditionGallery({ carId }: { carId: string }) {
  const [data, setData] = useState<{ asOf: string; photos: BookingConditionPhoto[] } | null | undefined>(undefined);

  useEffect(() => {
    carsApi.latestConditionPhotos(carId).then((res) => setData(res.data)).catch(() => setData(null));
  }, [carId]);

  if (!data || data.photos.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-lg font-bold text-gray-900">Verified Condition</h2>
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">✓ Real drop-off photos</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        From the most recently completed trip, as of {new Date(data.asOf).toLocaleDateString()} — the same required photos every guest takes at drop-off, shown here before you book.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {data.photos.map((p) => (
          <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={ANGLE_LABELS[p.angle] ?? p.angle} className="w-full h-full object-cover" />
            <span className="absolute bottom-1 left-1 right-1 text-[10px] font-semibold text-white bg-black/50 rounded px-1.5 py-0.5 text-center truncate">
              {ANGLE_LABELS[p.angle] ?? p.angle}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
