'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../components/AdminShell';
import { adminApi } from '../lib/api';
import type { AdminStats } from '../lib/types';

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: 'warning' | 'danger' }) {
  const toneClass = tone === 'warning' ? 'text-amber-400' : tone === 'danger' ? 'text-red-400' : 'text-white';
  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
      <p className="text-slate-500 text-sm">{label}</p>
      <h2 className={`text-3xl font-extrabold mt-2 ${toneClass}`}>{value}</h2>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats().then((res) => setStats(res.data)).finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell title="Dashboard" subtitle="Platform-wide overview">
      {loading || !stats ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Metric label="Total Users" value={stats.userCount} />
          <Metric label="Total Cars" value={stats.carCount} />
          <Metric label="Total Bookings" value={stats.bookingCount} />
          <Metric label="GMV (Completed Trips)" value={`₹${stats.gmv.toLocaleString()}`} />
          <Metric label="Active Trips" value={stats.activeTrips} tone="warning" />
          <Metric label="Hosts Pending KYC" value={stats.pendingKyc} tone="danger" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {[
          { href: '/users', label: 'Manage Users', icon: '👥' },
          { href: '/cars', label: 'Manage Cars', icon: '🚗' },
          { href: '/content', label: 'Edit Site Content', icon: '📝' },
          { href: '/ai', label: 'AI Conversations', icon: '🤖' },
        ].map((l) => (
          <a key={l.href} href={l.href} className="bg-slate-900 border border-slate-800 hover:border-brand-600 rounded-2xl p-5 transition">
            <span className="text-2xl">{l.icon}</span>
            <p className="text-sm font-semibold text-slate-200 mt-2">{l.label}</p>
          </a>
        ))}
      </div>
    </AdminShell>
  );
}
