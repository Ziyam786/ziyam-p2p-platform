'use client';

import React, { useEffect, useState } from 'react';
import { carsApi } from '../lib/api';
import type { Car } from '../lib/types';

function gaugeColor(rating: number) {
  if (rating >= 4.5) return '#10b981';
  if (rating >= 3.5) return '#3b82f6';
  return '#ef4444';
}

function ratingLabel(rating: number) {
  if (rating >= 4.5) return 'Excellent';
  if (rating >= 3.5) return 'Good';
  if (rating >= 2.5) return 'Fair';
  return 'Needs work';
}

export default function RatingsPanel({ car }: { car: Car }) {
  const [summary, setSummary] = useState<{ summary: string | null; positiveTags: string[]; negativeTags: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    carsApi
      .reviewSummary(car.id)
      .then((res) => active && setSummary(res.data))
      .catch(() => active && setSummary({ summary: null, positiveTags: [], negativeTags: [] }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [car.id]);

  const pct = Math.max(0, Math.min(1, car.rating / 5));
  const color = gaugeColor(car.rating);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center gap-8 bg-white border border-gray-100 rounded-2xl p-6">
        <div className="relative w-36 h-24">
          <svg viewBox="0 0 100 55" className="w-36 h-24">
            <path d="M 8 50 A 42 42 0 0 1 92 50" fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
            <path
              d="M 8 50 A 42 42 0 0 1 92 50"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${pct * 132} 132`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span className="text-2xl font-extrabold text-gray-900">★ {car.rating.toFixed(2)}</span>
            <span className="text-xs font-semibold" style={{ color }}>{ratingLabel(car.rating)}</span>
          </div>
        </div>
        <div className="text-center sm:text-left">
          <p className="text-sm text-gray-500">
            <span className="font-bold text-gray-900">{car.reviewCount}</span> reviews
          </p>
          <p className="text-xs text-gray-400 mt-1">Higher ratings boost your visibility in search results.</p>
        </div>
      </div>

      <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5">
        <h4 className="text-sm font-bold text-violet-700 mb-2">✨ AI Summary from Real Guest Reviews</h4>
        {loading ? (
          <p className="text-sm text-gray-400">Summarizing reviews…</p>
        ) : !summary?.summary ? (
          <p className="text-sm text-gray-400">Not enough reviews yet to generate a summary.</p>
        ) : (
          <>
            <p className="text-sm text-gray-700 mb-3">{summary.summary}</p>
            <div className="flex flex-wrap gap-2">
              {summary.positiveTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs font-medium bg-white border border-emerald-200 text-emerald-700 rounded-full px-3 py-1">
                  ✓ {tag}
                </span>
              ))}
              {summary.negativeTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs font-medium bg-white border border-red-200 text-red-600 rounded-full px-3 py-1">
                  ! {tag}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: '🧼', title: 'Clean & Tidy', body: 'Offer your car in great condition.' },
          { icon: '💬', title: 'Stay Connected', body: 'Respond quickly and show that you care.' },
          { icon: '🤝', title: 'Be Honest', body: 'Share every detail about your car upfront.' },
          { icon: '⏰', title: 'Be on Time', body: 'Ensure to serve your car without delays.' },
        ].map((tip) => (
          <div key={tip.title} className="border border-gray-100 rounded-xl p-4 text-center">
            <span className="text-xl block mb-2">{tip.icon}</span>
            <p className="text-xs font-bold text-gray-800">{tip.title}</p>
            <p className="text-[11px] text-gray-500 mt-1">{tip.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
