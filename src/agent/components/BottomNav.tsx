'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/jobs', label: 'Jobs', icon: '🛠️' },
  { href: '/bookings', label: 'Trips', icon: '🚗' },
  { href: '/cash-log', label: 'Cash', icon: '💰' },
  { href: '/settings', label: 'More', icon: '⚙️' },
];

/** Fixed mobile bottom tab bar — this app is used on phones by ground staff. */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-xl mx-auto grid grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                active ? 'text-brand-500' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-lg leading-none" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
