'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import Tabs from '../../../components/Tabs';
import { adminApi } from '../../../lib/api';
import { LogoBadge } from '../../../components/Logo';
import type { AdminStats, Booking, PublicUser } from '../../../lib/types';

function DashboardInner() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.stats(), adminApi.bookings(), adminApi.users()])
      .then(([s, b, u]) => {
        setStats(s.data);
        setBookings(b.data);
        setUsers(u.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <header className="px-8 pt-8 mb-6 border-b border-gray-800 pb-5 flex items-center gap-3">
        <LogoBadge className="w-10 h-10 shrink-0 rounded-xl" />
        <h1 className="text-2xl font-bold tracking-wide text-amber-500">
          Ziyam <span className="text-white text-lg font-normal">| Admin Console</span>
        </h1>
      </header>

      <div className="px-8">
        <Tabs
          variant="dark"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: 'Overview' },
            { key: 'bookings', label: `Bookings (${bookings.length})` },
            { key: 'users', label: `Users (${users.length})` },
          ]}
        />
      </div>

      <div className="p-8">
        {loading ? (
          <p className="text-gray-400">Loading admin data…</p>
        ) : tab === 'overview' && stats ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <Metric label="Total Users" value={stats.userCount} />
            <Metric label="Total Cars" value={stats.carCount} />
            <Metric label="Total Bookings" value={stats.bookingCount} />
            <Metric label="GMV (Completed Trips)" value={`₹${stats.gmv.toLocaleString()}`} />
            <Metric label="Active Trips" value={stats.activeTrips} tone="warning" />
            <Metric label="Hosts Pending KYC" value={stats.pendingKyc} tone="negative" />
          </div>
        ) : tab === 'bookings' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="py-2 pr-4">Car</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-gray-900">
                    <td className="py-3 pr-4">{b.car?.make} {b.car?.model} <span className="text-gray-500">({b.car?.city})</span></td>
                    <td className="py-3 pr-4 text-gray-300">{b.customer?.fullName ?? '—'}</td>
                    <td className="py-3 pr-4">₹{b.totalAmount.toLocaleString()}</td>
                    <td className="py-3 pr-4"><span className="bg-gray-800 px-2 py-1 rounded-full text-xs">{b.status}</span></td>
                    <td className="py-3 pr-4 text-gray-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">KYC</th>
                  <th className="py-2 pr-4">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-900">
                    <td className="py-3 pr-4">{u.fullName}</td>
                    <td className="py-3 pr-4 text-gray-400">{u.email}</td>
                    <td className="py-3 pr-4"><span className="bg-gray-800 px-2 py-1 rounded-full text-xs">{u.role}</span></td>
                    <td className="py-3 pr-4">{u.isKycVerified ? '✅' : '—'}</td>
                    <td className="py-3 pr-4 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: 'warning' | 'negative' }) {
  const toneClass = tone === 'warning' ? 'text-amber-400' : tone === 'negative' ? 'text-red-400' : 'text-white';
  return (
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
      <p className="text-gray-400 text-sm">{label}</p>
      <h2 className={`text-3xl font-extrabold mt-2 ${toneClass}`}>{value}</h2>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute roles={['ADMIN']}>
      <DashboardInner />
    </ProtectedRoute>
  );
}
