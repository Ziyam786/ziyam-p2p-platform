'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminBooking } from '../../lib/types';

type LiveState = { latitude: number; longitude: number; updatedAt: string | null; source: 'TELEMATICS' | 'HOST_APP' } | null;

function minutesAgo(iso: string | null | undefined) {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export default function ActiveTripsPage() {
  const { show } = useToast();
  const [trips, setTrips] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<Record<string, LiveState | 'loading' | 'error'>>({});

  function load() {
    setLoading(true);
    adminApi.bookings('ACTIVE').then((res) => setTrips(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function refreshLocation(id: string) {
    setLive((prev) => ({ ...prev, [id]: 'loading' }));
    try {
      const res = await adminApi.bookingLiveLocation(id);
      setLive((prev) => ({ ...prev, [id]: res.data }));
    } catch (err: any) {
      setLive((prev) => ({ ...prev, [id]: 'error' }));
      show(err.message ?? 'Failed to fetch live location', 'error');
    }
  }

  return (
    <AdminShell title="Active Trips" subtitle={`${trips.length} trip${trips.length === 1 ? '' : 's'} currently underway`}>
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : trips.length === 0 ? (
        <p className="text-slate-500 text-center py-16">No trips are currently active.</p>
      ) : (
        <div className="space-y-3">
          {trips.map((t) => {
            const state = live[t.id];
            const lastReported = minutesAgo(t.liveLocationUpdatedAt);
            const overdue = new Date(t.endTime).getTime() < Date.now();
            return (
              <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[220px]">
                  <p className="font-bold text-slate-100">
                    {t.car?.make} {t.car?.model} <span className="text-slate-500 font-normal text-xs">{t.car?.registrationNo} · {t.car?.city}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.customer?.fullName} · {t.customer?.phoneNumber}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(t.startTime).toLocaleString()} → {new Date(t.endTime).toLocaleString()}
                    {overdue && <span className="ml-1.5 text-amber-400 font-semibold">⚠ Return overdue</span>}
                  </p>
                </div>

                <div className="text-xs text-slate-400 shrink-0 min-w-[200px]">
                  {state === undefined &&
                    (t.liveLatitude != null && t.liveLongitude != null ? (
                      <p>Last reported {lastReported != null ? `${lastReported}m ago` : '—'} (tap Refresh for live)</p>
                    ) : (
                      <p className="text-slate-600">No location reported yet</p>
                    ))}
                  {state === 'loading' && <p>Fetching…</p>}
                  {state === 'error' && <p className="text-red-400">Failed to fetch</p>}
                  {state === null && <p className="text-slate-600">No location reported yet</p>}
                  {state && state !== 'loading' && state !== 'error' && (
                    <div>
                      <p className={state.source === 'TELEMATICS' ? 'text-emerald-400' : 'text-slate-300'}>
                        {state.source === 'TELEMATICS' ? '📡 Live telematics' : '📍 Host-reported'}
                        {state.updatedAt ? ` · ${minutesAgo(state.updatedAt)}m ago` : ''}
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${state.latitude},${state.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-400 hover:text-brand-300 font-semibold"
                      >
                        Open in Google Maps ↗
                      </a>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => refreshLocation(t.id)}
                  disabled={state === 'loading'}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 transition shrink-0"
                >
                  {state === 'loading' ? 'Refreshing…' : 'Refresh location'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
