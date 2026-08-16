'use client';

import React from 'react';

/**
 * Branded full-screen loader — the logo ring + Z stroke-draws in, then the
 * wordmark fades up. Matches the dark-espresso/cream palette from the
 * official splash animation, recreated in CSS/SVG rather than a shipped
 * video asset (keeps the bundle light, matches the loop feel).
 */
export default function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#2B1E17]">
      <div className="flex flex-col items-center gap-5">
        <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="41" stroke="#F3E9D8" strokeOpacity="0.15" strokeWidth="9" />
          <circle
            cx="50" cy="50" r="41" stroke="#F3E9D8" strokeWidth="9" strokeLinecap="round"
            pathLength={100} strokeDasharray={100} className="animate-[ziyam-ring_1.6s_ease-in-out_infinite]"
          />
          <path
            d="M 30 32 L 70 32 L 30 68 L 70 68" stroke="#F3E9D8" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
            pathLength={100} strokeDasharray={100} className="animate-[ziyam-z_1.6s_ease-in-out_infinite]"
          />
        </svg>
        <div className="text-center">
          <p className="text-[#F3E9D8] text-lg font-extrabold tracking-tight">
            Ziyam<span className="font-medium opacity-90">SelfDrive</span>
          </p>
          {label && <p className="text-[#F3E9D8]/60 text-xs mt-1">{label}</p>}
        </div>
      </div>
      <style>{`
        @keyframes ziyam-ring {
          0% { stroke-dashoffset: 100; opacity: 0.3; }
          55% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes ziyam-z {
          0%, 40% { stroke-dashoffset: 100; opacity: 0; }
          80% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
