'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';

/** The mark on its dark espresso badge — matches the renter/admin apps' brand mark exactly (see src/frontend/components/Logo.tsx), the complete ring with the Z woven through it. */
function LogoBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ziyam-badge-gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3A2A1F" />
          <stop offset="1" stopColor="#201510" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#ziyam-badge-gradient)" />
      <circle cx="50" cy="50" r="35" stroke="#F3E9D8" strokeWidth="8" fill="none" />
      <path d="M 33 34 L 76 26 L 24 74 L 67 66" stroke="#F3E9D8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <LogoBadge className="w-14 h-14 mx-auto mb-3 rounded-2xl" />
          <span className="text-2xl font-extrabold text-brand-400 tracking-tight">Ziyam</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest ml-2">Agent</span>
          <p className="text-slate-500 text-sm mt-2">Ground-staff sign-in</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          {error && <div className="bg-red-950/50 border border-red-900 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="agent@ziyam.in"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white font-bold py-3 rounded-xl transition"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
