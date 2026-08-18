'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

const TABS = [
  { href: '/host/dashboard', icon: '🏠', label: 'Home' },
  { href: '/host/dashboard?tab=cars', icon: '🚗', label: 'My Cars' },
  { href: '/host/dashboard?tab=trips', icon: '📅', label: 'Trips' },
  { href: '/host/earnings-calculator', icon: '💰', label: 'Earnings' },
  { href: '/account', icon: '👤', label: 'Profile' },
];

export default function HostBottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user || (user.role !== 'SELF_HOST' && user.role !== 'FLEET_OPERATOR')) return null;

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-[80] bg-white border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch justify-around px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href.split('?')[0]);
          return (
            <a
              key={tab.label}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[11px] font-semibold transition ${
                active ? 'text-amber-500' : 'text-gray-400'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
