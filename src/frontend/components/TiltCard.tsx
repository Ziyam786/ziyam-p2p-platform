'use client';

import React, { useRef } from 'react';
import { motion, useMotionValue, useMotionTemplate, useSpring, useTransform, useReducedMotion } from 'motion/react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** Max rotation in degrees applied on each axis as the cursor moves across the card. */
  maxTilt?: number;
  /** Cursor-following light sweep — a cheap stand-in for real specular highlights on a "metallic chrome" surface. */
  glare?: boolean;
}

/**
 * Wraps any content in a cursor-driven CSS 3D perspective tilt — the
 * "well-executed CSS 3D tilt reads as 3D" approach from the design brief,
 * rather than a full 3D engine. Pure transform/opacity so it stays
 * compositor-cheap, and it fully disables itself under prefers-reduced-motion
 * (falls back to a plain static wrapper — no listeners, no motion values).
 */
export default function TiltCard({ children, className = '', maxTilt = 10, glare = true }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const springCfg = { stiffness: 220, damping: 22, mass: 0.4 };
  const rotateX = useSpring(useTransform(py, [0, 1], [maxTilt, -maxTilt]), springCfg);
  const rotateY = useSpring(useTransform(px, [0, 1], [-maxTilt, maxTilt]), springCfg);
  const glareOpacity = useSpring(0, { stiffness: 200, damping: 30 });
  const glareX = useTransform(px, (v) => `${v * 100}%`);
  const glareY = useTransform(py, (v) => `${v * 100}%`);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.28), transparent 55%)`;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }
  function handleEnter() {
    glareOpacity.set(1);
  }
  function handleLeave() {
    px.set(0.5);
    py.set(0.5);
    glareOpacity.set(0);
  }

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div style={{ perspective: 1200 }} className={className}>
      <motion.div
        ref={ref}
        onMouseMove={handleMove}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative h-full w-full"
      >
        {children}
        {glare && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] z-10"
            style={{ opacity: glareOpacity, background: glareBackground }}
          />
        )}
      </motion.div>
    </div>
  );
}
