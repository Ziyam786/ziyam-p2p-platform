'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../components/ProtectedRoute';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../lib/auth-context';
import { agentApi, cashLogApi, opsTripApi } from '../lib/api';
import type { OpsTripRow } from '../lib/types';

function inr(n?: number | null) {
  return n == null ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-amber-500/10 text-amber-400',
  RUNNING: 'bg-blue-500/10 text-blue-400',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
};

function HomeInner() {
  const { user, logout } = useAuth();
  const [trips, setTrips] = useState<OpsTripRow[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [cashNet, setCashNet] = useState<number | null>(null);
  const [openJobs, setOpenJobs] = useState<number | null>(null);

  function load() {
    setTripsLoading(true);
    opsTripApi.list({ status: 'RUNNING' }).then((res) => setTrips(res.data)).finally(() => setTripsLoading(false));
    cashLogApi.list(60).then((res) => setCashNet(res.summary.net)).catch(() => {});
    agentApi
      .queue()
      .then((res) => setOpenJobs(res.data.filter((j) => j.status === 'REQUESTED' || j.status === 'CONFIRMED').length))
      .catch(() => {});
  }

  useEffect(load, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-extrabold text-lg">Ziyam Agent</h1>
          <p className="text-xs text-slate-500">Signed in as {user?.fullName}</p>
        </div>
        <button onClick={() => logout()} className="text-xs font-semibold text-slate-400 hover:text-white">
          Sign out
        </button>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 mb-1">Active Trips</p>
            <p className="text-2xl font-extrabold">{tripsLoading ? '—' : trips.length}</p>
          </div>
          <Link href="/jobs" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition">
            <p className="text-xs text-slate-500 mb-1">Open Jobs</p>
            <p className="text-2xl font-extrabold text-amber-400">{openJobs == null ? '—' : openJobs}</p>
          </Link>
          <Link href="/cash-log" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition col-span-2">
            <p className="text-xs text-slate-500 mb-1">Cash Net (60d)</p>
            <p className={`text-2xl font-extrabold ${cashNet != null && cashNet < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {cashNet == null ? '—' : inr(cashNet)}
            </p>
          </Link>
        </div>

        <Link
          href="/bookings/new"
          className="block w-full text-center bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-2xl transition mb-6"
        >
          + New Check-In
        </Link>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-300">Active Trips</h2>
          <Link href="/bookings" className="text-xs font-semibold text-brand-400 hover:text-brand-300">View all</Link>
        </div>

        {tripsLoading ? (
          <p className="text-slate-600 text-sm">Loading trips…</p>
        ) : trips.length === 0 ? (
          <p className="text-slate-600 text-sm">No active trips — check a customer in when they arrive.</p>
        ) : (
          <div className="space-y-3">
            {trips.slice(0, 5).map((trip) => {
              const handedOver = Boolean(trip.customerSignatureUrl);
              return (
                <div key={trip.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <Link href={`/bookings/${trip.id}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold truncate">{trip.customerName}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {trip.car ? `${trip.car.make} ${trip.car.model}` : trip.carId}
                          {trip.car?.registrationNo ? ` · ${trip.car.registrationNo}` : ''}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[trip.status] ?? 'bg-slate-800 text-slate-400'}`}>
                        {trip.status}
                      </span>
                    </div>
                  </Link>
                  <Link
                    href={`/bookings/${trip.id}?step=${handedOver ? 'checkout' : 'handover'}`}
                    className={`mt-3 block text-center text-xs font-bold px-4 py-2.5 rounded-lg transition ${
                      handedOver ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-brand-600 hover:bg-brand-700 text-white'
                    }`}
                  >
                    {handedOver ? 'Return' : 'Handover'}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute>
      <HomeInner />
    </ProtectedRoute>
  );
}
