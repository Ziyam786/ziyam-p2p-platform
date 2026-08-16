'use client';

import React, { useEffect, useState } from 'react';
import { LogoBadge } from './Logo';
import { COMPANY } from '../lib/companyInfo';
import { settingsApi } from '../lib/api';

const links = {
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press', href: '/press' },
    { label: 'Blog', href: '/blog' },
  ],
  Rentals: [
    { label: 'Browse Cars', href: '/cars' },
    { label: 'Cities', href: '/cities' },
    { label: 'Subscription Plans', href: '/subscription' },
    { label: 'Corporate Rentals', href: '/corporate' },
  ],
  Support: [
    { label: 'Help Center', href: '/support' },
    { label: 'Contact Us', href: '/support#contact' },
    { label: 'Safety', href: '/safety' },
    { label: 'Terms & Conditions', href: '/terms' },
    { label: 'Refund & Cancellation Policy', href: '/refund-policy' },
  ],
  'Host Your Car': [
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Host Policy', href: '/host/policy' },
    { label: 'Host FAQ', href: '/host/faq' },
    { label: 'Earnings Calculator', href: '/host/earnings-calculator' },
    { label: 'Insurance & Damage Policy', href: '/insurance' },
  ],
};

export default function Footer() {
  // Falls back to the static defaults (COMPANY) until — or if — the admin-editable
  // Setting loads, so the footer never flashes empty/broken content.
  const [info, setInfo] = useState(COMPANY);

  useEffect(() => {
    settingsApi
      .public()
      .then((res) => {
        if (res.data.company_info) setInfo({ ...COMPANY, ...res.data.company_info });
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="bg-gray-950 text-gray-400 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <LogoBadge className="w-9 h-9 shrink-0 rounded-xl" />
              <span className="text-lg font-extrabold text-amber-500">Ziyam<span className="text-white font-semibold">SelfDrive</span></span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              India's trusted peer-to-peer self-drive car rental platform, operated by {info.legalName}. {info.scopeNote}
            </p>
            <div className="text-xs text-gray-500 space-y-1 mb-4">
              <p>{info.address}</p>
              <p>
                <a href={`mailto:${info.email}`} className="hover:text-amber-400 transition">{info.email}</a>
                {' · '}
                <a href={`tel:${info.phone.replace(/\s/g, '')}`} className="hover:text-amber-400 transition">{info.phone}</a>
              </p>
              <p className="text-gray-600">CIN {info.cin}</p>
            </div>
          </div>

          {Object.entries(links).map(([heading, items]) => (
            <div key={heading}>
              <h4 className="text-white font-semibold text-sm mb-4">{heading}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="text-xs hover:text-amber-400 transition">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} {info.legalName}. All rights reserved.</span>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/terms" className="hover:text-amber-400 transition">Terms of Use</a>
            <a href="/refund-policy" className="hover:text-amber-400 transition">Refund Policy</a>
            <a href="/cookies" className="hover:text-amber-400 transition">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
