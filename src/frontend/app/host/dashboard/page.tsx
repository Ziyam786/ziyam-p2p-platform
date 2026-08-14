'use client';

import React, { useEffect, useState } from 'react';
import { getStoredUser, authFetch, AuthUser } from '../../../lib/auth';

interface EarningsOverview {
  totalGross: number;
  ziyamCut: number;
  netEarnings: number;
  pendingEscrow: number;
  settledPayouts: number;
}

const EMPTY: EarningsOverview = {
  totalGross: 0,
  ziyamCut: 0,
  netEarnings: 0,
  pendingEscrow: 0,
  settledPayouts: 0,
};

export default function FleetOperatorDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [metrics, setMetrics] = useState<EarningsOverview>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);

    const hostId = stored?.id;
    if (!hostId || !['SELF_HOST', 'FLEET_OPERATOR', 'ADMIN'].includes(stored.role)) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const res = await authFetch(`/api/host/${hostId}/earnings`);
        const json = await res.json();
        if (json.success) setMetrics(json.data);
      } catch (err) {
        console.error('Failed to load earnings', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (!loading && (!user || !['SELF_HOST', 'FLEET_OPERATOR', 'ADMIN'].includes(user.role))) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8 font-sans flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-amber-500 mb-3">Host Access Required</h1>
        <p className="text-gray-400 mb-6 max-w-md">
          Sign in with a host account to view your fleet earnings, or sign up to start listing your car.
        </p>
        <div className="flex gap-4">
          <a href="/login" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-5 py-2.5 rounded-lg transition">
            Log In
          </a>
          <a href="/signup" className="border border-gray-700 hover:border-amber-500 text-white font-semibold px-5 py-2.5 rounded-lg transition">
            Become a Host
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 font-sans">
      <header className="mb-10 flex justify-between items-center border-b border-gray-800 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-wide text-amber-500">
            ZIYAM <span className="text-white text-lg font-normal">| Fleet Control Center</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Operated by Eightlines</p>
        </div>
        <button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-5 py-2.5 rounded-lg transition">
          + Add New Vehicle
        </button>
      </header>

      {loading ? (
        <p className="text-gray-400">Loading earnings…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <MetricCard label="Total Fleet Revenue" value={metrics.totalGross} sub="Gross rental bookings" />
          <MetricCard
            label="Ziyam Platform Cut (30%)"
            value={-metrics.ziyamCut}
            sub="Platform & insurance share"
            tone="negative"
          />
          <MetricCard
            label="Your Net Profit (70%)"
            value={metrics.netEarnings}
            sub="Host direct share"
            tone="positive"
          />
          <MetricCard
            label="Escrow Queue (N+1)"
            value={metrics.pendingEscrow}
            sub="Releasing per settlement policy"
            tone="warning"
          />
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-bold mb-4">Payout Schedule & Settlement Terms</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
          <Policy title="70/30 Revenue Split" body="You keep 70% of the base fare. Ziyam takes 30% for marketing, insurance, dynamic pricing, and support." />
          <Policy title="N+1 Settlement Policy" body="Payouts are calculated automatically at trip end and credited to your linked bank account on the N+1 schedule." />
          <Policy title="Security Deposit Shield" body="User security deposits are held separately to cover fast-track damage claims or toll overages." />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: 'positive' | 'negative' | 'warning';
}) {
  const toneClasses = {
    positive: 'border-emerald-500/30 bg-emerald-950/10 text-emerald-400',
    negative: 'text-red-400',
    warning: 'border-amber-500/30 bg-amber-950/10 text-amber-400',
  };
  const cardTone = tone === 'positive' || tone === 'warning' ? toneClasses[tone] : '';
  const valueTone = tone ? toneClasses[tone].split(' ').filter((c) => c.startsWith('text-'))[0] : '';

  return (
    <div className={`bg-gray-900 border border-gray-800 p-6 rounded-xl ${cardTone}`}>
      <p className="text-gray-400 text-sm">{label}</p>
      <h2 className={`text-3xl font-extrabold mt-2 ${valueTone}`}>
        {value < 0 ? '-' : ''}₹{Math.abs(value).toLocaleString()}
      </h2>
      <span className="text-xs text-gray-500">{sub}</span>
    </div>
  );
}

function Policy({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-4 bg-gray-950 rounded-lg border border-gray-800">
      <span className="font-semibold text-amber-400">{title}</span>
      <p className="text-xs text-gray-400 mt-1">{body}</p>
    </div>
  );
}
