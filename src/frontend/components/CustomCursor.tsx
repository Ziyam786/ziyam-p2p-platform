'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"], .magnetic';

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringScale = useMotionValue(1);
  const dotScale = useMotionValue(1);

  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const dotX = useSpring(x, { damping: 30, stiffness: 500 });
  const dotY = useSpring(y, { damping: 30, stiffness: 500 });
  const ringX = useSpring(x, springConfig);
  const ringY = useSpring(y, springConfig);
  const ringScaleSpring = useSpring(ringScale, { damping: 20, stiffness: 300 });
  const dotScaleSpring = useSpring(dotScale, { damping: 20, stiffness: 400 });

  useEffect(() => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || reducedMotion) return;

    setEnabled(true);
    document.documentElement.classList.add('custom-cursor-active');

    // The hovered element + its rect are cached and only recomputed when the
    // hovered element actually changes (pointerover/pointerout), never on
    // every mousemove — calling getBoundingClientRect() per mousemove forces
    // a synchronous layout reflow on nearly every pixel of cursor travel,
    // which is what was causing the site-wide input lag.
    let magneticTarget: HTMLElement | null = null;
    let magneticRect: DOMRect | null = null;

    function handleMove(e: MouseEvent) {
      if (magneticTarget && magneticRect) {
        const cx = magneticRect.left + magneticRect.width / 2;
        const cy = magneticRect.top + magneticRect.height / 2;
        const pull = 0.35;
        x.set(e.clientX + (cx - e.clientX) * pull);
        y.set(e.clientY + (cy - e.clientY) * pull);
      } else {
        x.set(e.clientX);
        y.set(e.clientY);
      }
    }

    function handleOver(e: PointerEvent) {
      const el = (e.target as HTMLElement)?.closest?.(INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (el && el !== magneticTarget) {
        magneticTarget = el;
        magneticRect = el.getBoundingClientRect();
        ringScale.set(1.75);
      }
    }

    function handleOut(e: PointerEvent) {
      const el = (e.target as HTMLElement)?.closest?.(INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (el && el === magneticTarget) {
        magneticTarget = null;
        magneticRect = null;
        ringScale.set(1);
      }
    }

    function handleDown() {
      dotScale.set(0.7);
    }
    function handleUp() {
      dotScale.set(1);
    }
    function handleLeave() {
      x.set(-100);
      y.set(-100);
    }

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('pointerover', handleOver, { passive: true });
    window.addEventListener('pointerout', handleOut, { passive: true });
    window.addEventListener('mousedown', handleDown, { passive: true });
    window.addEventListener('mouseup', handleUp, { passive: true });
    document.addEventListener('mouseleave', handleLeave);

    return () => {
      document.documentElement.classList.remove('custom-cursor-active');
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('pointerover', handleOver);
      window.removeEventListener('pointerout', handleOut);
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mouseup', handleUp);
      document.removeEventListener('mouseleave', handleLeave);
    };
  }, [x, y, ringScale, dotScale]);

  if (!enabled) return null;

  return (
    <>
      {/* Glowing gradient trail ring — sized once via CSS, scaled via transform only (no layout cost) */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[200] rounded-full mix-blend-screen w-8 h-8"
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
          scale: ringScaleSpring,
          background: 'radial-gradient(circle, rgba(251,191,36,0.55) 0%, rgba(251,191,36,0.12) 55%, transparent 75%)',
        }}
      />
      {/* Solid core dot */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[200] rounded-full bg-amber-400 w-1.5 h-1.5"
        style={{
          x: dotX,
          y: dotY,
          translateX: '-50%',
          translateY: '-50%',
          scale: dotScaleSpring,
        }}
      />
    </>
  );
}
