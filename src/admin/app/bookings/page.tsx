'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminBooking, BookingStatus } from '../../lib/types';

const STATUSES: BookingStatus[] = ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

export default function BookingsPage() {
  const { show } = useToast();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminApi.bookings(statusFilter || undefined).then((res) => setBookings(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter]);

  async function forceCancel(b: AdminBooking) {
    if (!confirm(`Force-cancel this booking for ${b.car?.make} ${b.car?.model}?`)) return;
    setBusyId(b.id);
    try {
      await adminApi.updateBooking(b.id, 'CANCELLED');
      show('Booking cancelled', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      title="Bookings"
      subtitle={`${bookings.length} bookings`}
      action={
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      }
    >
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4">Car</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-3 px-4 font-medium text-slate-200">{b.car?.make} {b.car?.model} <span className="text-slate-500 text-xs">({b.car?.city})</span></td>
                  <td className="py-3 px-4 text-slate-400">{b.customer?.fullName ?? '—'}</td>
                  <td className="py-3 px-4 text-slate-400 text-xs">
                    {new Date(b.startTime).toLocaleDateString()} → {new Date(b.endTime).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-slate-400">₹{b.totalAmount.toLocaleString()}</td>
                  <td className="py-3 px-4"><span className="bg-slate-800 px-2 py-1 rounded-full text-xs">{b.status}</span></td>
                  <td className="py-3 px-4">
                    {['PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE'].includes(b.status) && (
                      <button
                        disabled={busyId === b.id}
                        onClick={() => forceCancel(b)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition"
                      >
                        Force Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
