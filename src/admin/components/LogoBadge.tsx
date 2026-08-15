import React from 'react';

/** The mark on its dark espresso badge, matching the renter site's brand mark. */
export default function LogoBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="22" fill="#2B1E17" />
      <path d="M 22.98 59.29 A 29 29 0 0 1 60.29 21.98" stroke="#F3E9D8" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M 77.02 40.71 A 29 29 0 0 1 39.71 78.02" stroke="#F3E9D8" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M 33 34 L 67 34 L 33 66 L 67 66" stroke="#F3E9D8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
