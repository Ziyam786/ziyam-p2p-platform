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
 * Standalone, reusable path-tracing animation of the ring+Z mark — the ring
 * and Z stroke-draw in an infinite loop via real SVG path animation
 * (motion's pathLength), not a CSS dasharray hack. Same weaving-Z geometry
 * as Logo.tsx (verified against the reference splash screen) so every logo
 * usage in the app stays visually in sync. Used by LoadingScreen.tsx for the
 * full-screen splash, and available standalone for inline loading states
 * (buttons, cards, etc.) — just drop it in at whatever size you need.
 */
export default function ZiyamLogoLoader({ className, strokeColor = '#F3E9D8' }: { className?: string; strokeColor?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="41" stroke={strokeColor} strokeOpacity="0.15" strokeWidth="9" />
      <motion.circle
        cx="50" cy="50" r="41" stroke={strokeColor} strokeWidth="9" strokeLinecap="round"
        initial="hidden" animate="visible" variants={ringTrace}
      />
      <motion.path
        d="M 30 32 L 80 22 L 20 78 L 70 68" stroke={strokeColor} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
        initial="hidden" animate="visible" variants={zTrace}
      />
    </svg>
  );
}
