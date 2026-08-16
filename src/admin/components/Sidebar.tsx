'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import LogoBadge from './LogoBadge';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/users', label: 'Users', icon: '👥' },
  { href: '/cars', label: 'Cars', icon: '🚗' },
  { href: '/bookings', label: 'Bookings', icon: '📅' },
  { href: '/ops-trips', label: 'Ops Trips', icon: '🔑' },
  { href: '/reviews', label: 'Reviews', icon: '⭐' },
  { href: '/payouts', label: 'Payouts', icon: '💸' },
  { href: '/fleet-ledger', label: 'Fleet Ledger', icon: '📒' },
  { href: '/finance', label: 'Financial ERP', icon: '🏦' },
  { href: '/promo-codes', label: 'Promo Codes', icon: '🎟️' },
  { href: '/content', label: 'Site Content', icon: '📝' },
  { href: '/settings', label: 'Platform Settings', icon: '⚙️' },
  { href: '/ai', label: 'AI Assistant', icon: '🤖' },
  { href: '/audit-log', label: 'Audit Log', icon: '🧾' },
];

// Opens EightLines' existing Marc8 fleet-ops tool (separate Supabase-backed app —
// maintenance logs, tyre health, cross-platform trip tracking, revenue split) in a
// new tab. Not merged into this admin's auth/data yet, just linked for now.
const EXTERNAL_NAV = [
  { href: 'https://ziyam.in/marc8-dashboard', label: 'Fleet Ops (Marc8)', icon: '🛠️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <aside className="w-64 shrink-0 bg-slate-900 border-r border-slate-800 min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <LogoBadge className="w-8 h-8 shrink-0 rounded-lg" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-brand-400 tracking-tight">Ziyam</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Control</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-600 mt-1">Internal admin panel</p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          );
        })}

        <div className="pt-3 mt-3 border-t border-slate-800">
          <p className="px-3 pb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">External</p>
          {EXTERNAL_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
            >
              <span>{item.icon}</span>
              {item.label}
              <span className="ml-auto text-slate-600 text-xs">↗</span>
            </a>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
        <button onClick={handleLogout} className="mt-2 text-xs font-semibold text-red-400 hover:text-red-300">
          Log Out
        </button>
      </div>
    </aside>
  );
}
