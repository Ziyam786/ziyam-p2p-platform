'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import BottomNav from '../../components/BottomNav';
import { useAuth } from '../../lib/auth-context';

function SettingsInner() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="border-b border-slate-800 px-4 py-4">
        <h1 className="font-extrabold text-lg">Settings</h1>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Name</p>
          <p className="font-bold mb-4">{user?.fullName ?? '—'}</p>

          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Email</p>
          <p className="font-bold mb-4">{user?.email ?? '—'}</p>

          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Role</p>
          <p className="font-bold">{user?.role ?? '—'}</p>
        </div>

        <button
          type="button"
          disabled={loggingOut}
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition"
        >
          {loggingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </main>

      <BottomNav />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsInner />
    </ProtectedRoute>
  );
}
