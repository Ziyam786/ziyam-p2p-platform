import React from 'react';

/** The "Z" monogram with its signature broken orbit ring, as a standalone stroke mark (no background). Matches LogoBadge's geometry so the two stay interchangeable. */
export function LogoMark({ className, color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 22.98 59.29 A 29 29 0 0 1 60.29 21.98" stroke={color} strokeWidth="8" strokeLinecap="round" />
      <path d="M 77.02 40.71 A 29 29 0 0 1 39.71 78.02" stroke={color} strokeWidth="8" strokeLinecap="round" />
      <path d="M 33 34 L 67 34 L 33 66 L 67 66" stroke={color} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The mark on its dark espresso badge, as seen on the splash screen and favicon — self-contained, works on any background. The broken orbit ring (vs. a full circle) is what gives it a distinct silhouette at a glance. */
export function LogoBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ziyam-badge-gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3A2A1F" />
          <stop offset="1" stopColor="#201510" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#ziyam-badge-gradient)" />
      <path d="M 22.98 59.29 A 29 29 0 0 1 60.29 21.98" stroke="#F3E9D8" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M 77.02 40.71 A 29 29 0 0 1 39.71 78.02" stroke="#F3E9D8" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M 33 34 L 67 34 L 33 66 L 67 66" stroke="#F3E9D8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Full lockup: badge + "ZiyamSelfDrive" wordmark, matching the reference splash screen composition. */
export function LogoFull({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ''}`}>
      <LogoBadge className="w-16 h-16" />
      <div className="text-center leading-tight">
        <span className="text-xl font-extrabold">Ziyam</span>
        <span className="text-xl font-medium">SelfDrive</span>
        {tagline && <p className="text-xs opacity-70 mt-0.5">By Eightlines</p>}
      </div>
    </div>
  );
}

export default function Logo({ className }: { className?: string }) {
  return (
    <a href="/" className={`flex items-center gap-2 ${className ?? ''}`}>
      <LogoBadge className="w-9 h-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-extrabold text-amber-500 tracking-tight">Ziyam<span className="font-semibold text-gray-700">SelfDrive</span></span>
      </span>
    </a>
  );
}
