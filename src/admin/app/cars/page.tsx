'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminCar } from '../../lib/types';

export default function CarsPage() {
  const { show } = useToast();
  const [cars, setCars] = useState<AdminCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminApi.cars().then((res) => setCars(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleFeatured(c: AdminCar) {
    setBusyId(c.id);
    try {
      await adminApi.updateCar(c.id, { featured: !c.featured });
      show(c.featured ? 'Removed from featured' : 'Featured on homepage', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAvailable(c: AdminCar) {
    setBusyId(c.id);
    try {
      await adminApi.updateCar(c.id, { isAvailable: !c.isAvailable });
      show(c.isAvailable ? 'Listing delisted' : 'Listing reactivated', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell title="Cars" subtitle={`${cars.length} listings across all hosts`}>
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4">Car</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4">Rate</th>
                <th className="py-3 px-4">Bookings</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((c) => (
                <tr key={c.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-3 px-4 font-medium text-slate-200">{c.make} {c.model} <span className="text-slate-500 text-xs">({c.registrationNo})</span></td>
                  <td className="py-3 px-4 text-slate-400">{c.owner?.fullName ?? '—'}</td>
                  <td className="py-3 px-4 text-slate-400">{c.city}</td>
                  <td className="py-3 px-4 text-slate-400">₹{c.dailyRate.toLocaleString()}/day</td>
                  <td className="py-3 px-4 text-slate-400">{c._count?.bookings ?? 0}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.isAvailable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {c.isAvailable ? 'Live' : 'Delisted'}
                    </span>
                  </td>
                  <td className="py-3 px-4 flex gap-2">
                    <button
                      disabled={busyId === c.id}
                      onClick={() => toggleFeatured(c)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                        c.featured ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {c.featured ? '★ Featured' : '☆ Feature'}
                    </button>
                    <button
                      disabled={busyId === c.id}
                      onClick={() => toggleAvailable(c)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                        c.isAvailable ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {c.isAvailable ? 'Delist' : 'Relist'}
                    </button>
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
