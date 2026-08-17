'use client';

import React from 'react';
import ZiyamLogoLoader from './ZiyamLogoLoader';

/**
 * Branded full-screen loader — wraps the standalone ZiyamLogoLoader
 * path-tracing mark with the wordmark and an optional status label.
 */
export default function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#2B1E17]">
      <div className="flex flex-col items-center gap-5">
        <ZiyamLogoLoader className="w-20 h-20 sm:w-24 sm:h-24" />
        <div className="text-center">
          <p className="text-[#F3E9D8] text-lg font-extrabold tracking-tight">
            Ziyam<span className="font-medium opacity-90">SelfDrive</span>
          </p>
          <p className="text-[#F3E9D8]/50 text-[10px] uppercase tracking-widest mt-0.5">By Eightlines</p>
          {label && <p className="text-[#F3E9D8]/60 text-xs mt-2">{label}</p>}
        </div>
      </div>
    </div>
  );
}
