import React from 'react';

/** The mark on its dark espresso badge, matching the renter site's brand mark exactly (see src/frontend/components/Logo.tsx) — a complete ring with the Z woven through it. */
export default function LogoBadge({ className }: { className?: string }) {
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
