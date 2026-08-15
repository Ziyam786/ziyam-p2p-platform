import React from 'react';
import { LogoBadge } from './Logo';

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
  ],
  'Host Your Car': [
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Earnings Calculator', href: '/host/earnings-calculator' },
    { label: 'Fleet Partners', href: '/host/onboarding' },
    { label: 'Insurance Coverage', href: '/insurance' },
  ],
};

export default function Footer() {
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
            <p className="text-xs text-gray-500 leading-relaxed">
              India's trusted peer-to-peer self-drive car rental platform. Operated by Eightlines.
            </p>
            <div className="flex gap-3 mt-4">
              {['twitter', 'instagram', 'linkedin', 'facebook'].map((s) => (
                <a
                  key={s}
                  href={`https://${s}.com`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full bg-gray-800 hover:bg-amber-500 flex items-center justify-center transition"
                  aria-label={s}
                >
                  <span className="text-xs capitalize text-white">{s[0].toUpperCase()}</span>
                </a>
              ))}
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
          <span>© {new Date().getFullYear()} ZiyamSelfDrive (Eightlines). All rights reserved.</span>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/terms" className="hover:text-amber-400 transition">Terms of Use</a>
            <a href="/cookies" className="hover:text-amber-400 transition">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
