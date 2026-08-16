import React from 'react';

/** The circular "Z" monogram — a complete ring with the Z woven through it, as a standalone stroke mark (no background). */
export function LogoMark({ className, color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="41" stroke={color} strokeWidth="9" />
      <path d="M 30 32 L 70 32 L 30 68 L 70 68" stroke={color} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The mark on its dark espresso badge, as seen on the splash screen — self-contained, works on any background. */
export function LogoBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#2B1E17" />
      <circle cx="50" cy="50" r="35" stroke="#F3E9D8" strokeWidth="8" fill="none" />
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
