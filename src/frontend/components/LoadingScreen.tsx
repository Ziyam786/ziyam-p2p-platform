'use client';

import React from 'react';
import { motion } from 'motion/react';

const ringTrace = {
  hidden: { pathLength: 0, opacity: 0.3 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 1.1, ease: [0.65, 0, 0.35, 1] as const, repeat: Infinity, repeatType: 'reverse' as const, repeatDelay: 0.4 },
  },
};

const zTrace = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.9, delay: 0.5, ease: [0.65, 0, 0.35, 1] as const, repeat: Infinity, repeatType: 'reverse' as const, repeatDelay: 0.9 },
  },
};

/**
 * Branded full-screen loader — the logo ring and Z stroke-trace in an
 * infinite loop via real path animation (motion's pathLength), not a CSS
 * dasharray hack. Same weaving-Z geometry as Logo.tsx (verified against the
 * reference splash screen), so this and every other logo usage stay in sync.
 */
export default function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#2B1E17]">
      <div className="flex flex-col items-center gap-5">
        <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="41" stroke="#F3E9D8" strokeOpacity="0.15" strokeWidth="9" />
          <motion.circle
            cx="50" cy="50" r="41" stroke="#F3E9D8" strokeWidth="9" strokeLinecap="round"
            initial="hidden" animate="visible" variants={ringTrace}
          />
          <motion.path
            d="M 30 32 L 80 22 L 20 78 L 70 68" stroke="#F3E9D8" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
            initial="hidden" animate="visible" variants={zTrace}
          />
        </svg>
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
