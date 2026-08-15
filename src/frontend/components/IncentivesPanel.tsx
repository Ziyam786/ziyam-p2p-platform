'use client';

import React, { useEffect, useState } from 'react';
import { carsApi } from '../lib/api';
import type { Car, IncentiveProgress } from '../lib/types';

export default function IncentivesPanel({ car }: { car: Car }) {
  const [data, setData] = useState<IncentiveProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    carsApi
      .incentives(car.id)
      .then((res) => active && setData(res.data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [car.id]);

  if (loading) return <p className="text-sm text-gray-400">Loading incentive progress…</p>;
  if (!data) return <p className="text-sm text-gray-400">Incentives aren't available for this listing yet.</p>;

  const { targets } = data;
  const metCount = Object.values(targets).filter((t) => t.met).length;
  const totalTargets = Object.keys(targets).length;
  const pctThroughMonth = Math.min(100, Math.round((data.daysElapsedThisMonth / (data.daysElapsedThisMonth + data.daysRemaining)) * 100));

  return (
    <div className="space-y-5">
      <div className="border border-gray-100 rounded-2xl p-5">
        {data.allMet ? (
          <>
            <p className="text-sm font-bold text-emerald-600">🎉 You're on track for this month's incentive</p>
            <p className="text-xs text-gray-500 mt-1">Keep meeting your targets to stay eligible</p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-amber-600">You're at risk of missing the incentive</p>
            <p className="text-xs text-gray-500 mt-1">Meet your targets to stay eligible</p>
          </>
        )}

        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-4 mb-1">
          <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pctThroughMonth}%` }} />
        </div>
        <p className="text-xs text-gray-400 mb-4">{data.daysRemaining} days remaining in {data.month}</p>

        <div className="space-y-3">
          <TargetRow
            label="100% Fulfillment"
            sub="Complete all bookings without cancellation"
            met={targets.fulfillment.met}
            display={`${targets.fulfillment.current}%`}
          />
          <TargetRow
            label="25+ Listing Days"
            sub="Keep your car listed to stay eligible"
            met={targets.listingDays.met}
            display={`${targets.listingDays.current}`}
          />
          <TargetRow
            label="4.5+ Rating"
            sub="Deliver great trips to keep your ratings high"
            met={targets.rating.met}
            display={`★ ${targets.rating.current}`}
          />
          <TargetRow
            label="Serve 10+ Bookings (or 22+ Booking Days)"
            sub={`You've served ${targets.bookings.current} bookings and ${targets.bookings.currentDays ?? 0} booking days`}
            met={targets.bookings.met}
            display={`${targets.bookings.current}`}
          />
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border border-violet-100">
        <div className="bg-violet-800 text-white px-5 py-3 text-sm font-semibold">
          💵 Serve bookings to start accumulating incentive amount!
        </div>
        <div className="bg-violet-50 px-5 py-4">
          <p className="font-bold text-gray-900 text-sm">{data.month} Incentive</p>
          <p className="text-xs text-gray-500 mt-1 mb-3">Meet all {totalTargets} targets this month to earn a bonus on every booking.</p>
          <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl font-extrabold text-amber-500">{data.bonusPercent}%</span>
            <div>
              <p className="text-sm font-bold text-gray-800">Extra Revenue</p>
              <p className="text-xs text-gray-500">on every booking you complete this month</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">{metCount} of {totalTargets} targets met</p>
    </div>
  );
}

function TargetRow({ label, sub, met, display }: { label: string; sub: string; met: boolean; display: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        met ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
      }`}>
        {met ? '✓' : display}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
    </div>
  );
}
