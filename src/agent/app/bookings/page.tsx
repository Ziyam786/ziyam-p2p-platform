'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import BottomNav from '../../components/BottomNav';
import { opsTripApi } from '../../lib/api';
import type { OpsTripRow } from '../../lib/types';

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-amber-500/10 text-amber-400',
  RUNNING: 'bg-blue-500/10 text-blue-400',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
};

type Tab = 'active' | 'history';

function TripsInner() {
  const [trips, setTrips] = useState<OpsTripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');

  useEffect(() => {
    opsTripApi.list({}).then((res) => setTrips(res.data)).finally(() => setLoading(false));
  }, []);

  const filtered = trips.filter((t) =>
    tab === 'active' ? t.status === 'RUNNING' || t.status === 'SCHEDULED' : t.status === 'COMPLETED' || t.status === 'CANCELLED'
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center justify-between">
        <h1 className="font-extrabold text-lg">Trips</h1>
        <Link
          href="/bookings/new"
          className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition"
        >
          + New
        </Link>
      </header>

      <div className="max-w-xl mx-auto px-4 pt-4">
        <div className="flex gap-1 border-b border-slate-800 mb-4">
          {(['active', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                tab === t ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'active' ? 'Active' : 'History'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading trips…</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-16">
            {tab === 'active' ? 'No active trips right now.' : 'No completed or cancelled trips yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((trip) => (
              <Link
                key={trip.id}
                href={`/bookings/${trip.id}`}
                className="block bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{trip.customerName}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{trip.customerMobile}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {trip.car ? `${trip.car.make} ${trip.car.model}` : trip.carId}
                      {trip.car?.registrationNo ? ` · ${trip.car.registrationNo}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">{new Date(trip.startTime).toLocaleString()}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[trip.status] ?? 'bg-slate-800 text-slate-400'}`}>
                    {trip.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default function TripsPage() {
  return (
    <ProtectedRoute>
      <TripsInner />
    </ProtectedRoute>
  );
}
