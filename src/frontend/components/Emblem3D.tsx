'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Interactive 3D badge: drag/pointer-tilt to rotate, optional auto-spin,
 * click-to-shine sweep, arrow-key nudge when focused. Ported from a static
 * HTML/CSS/JS mockup — the physics loop (rAF, spring-toward-target rotation,
 * drag vs. hover-tilt) is unchanged; the SVG artwork is swapped in via
 * plateSrc/artSrc so the same shell renders either brand's mark.
 */
export default function Emblem3D({
  plateSrc,
  artSrc,
  label,
  glareColor = '255,248,220',
  size = 260,
}: {
  plateSrc: string;
  artSrc: string;
  label: string;
  glareColor?: string;
  size?: number;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [spinning, setSpinning] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Mutable rotation state lives in refs, not React state — this runs every
  // animation frame, and re-rendering on every frame would be needlessly
  // expensive for something that never affects JSX structure, only inline
  // transform/CSS-variable values applied directly to the DOM node.
  const rx = useRef(0);
  const ry = useRef(0);
  const tx = useRef(0);
  const ty = useRef(0);
  const dragStart = useRef({ px: 0, py: 0, rx: 0, ry: 0 });

  useEffect(() => {
    const stage = stageRef.current;
    const badge = badgeRef.current;
    if (!stage || !badge) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId: number;
    let isDragging = false;
    let isSpinning = false;

    function apply() {
      if (!badge) return;
      badge.style.transform = `rotateX(${rx.current.toFixed(2)}deg) rotateY(${ry.current.toFixed(2)}deg)`;
      badge.style.setProperty('--gx', `${50 - ry.current * 1.5}%`);
      badge.style.setProperty('--gy', `${32 + rx.current * 1.5}%`);
    }

    function loop() {
      if (isSpinning && !isDragging) ry.current += 0.42;
      rx.current += (tx.current - rx.current) * 0.12;
      ry.current += (ty.current - ry.current) * (isDragging ? 0.35 : 0.12);
      apply();
      rafId = requestAnimationFrame(loop);
    }

    function onPointerDown(e: PointerEvent) {
      isDragging = true;
      setDragging(true);
      dragStart.current = { px: e.clientX, py: e.clientY, rx: tx.current, ry: ty.current };
    }
    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return;
      ty.current = dragStart.current.ry + (e.clientX - dragStart.current.px) * 0.35;
      tx.current = dragStart.current.rx - (e.clientY - dragStart.current.py) * 0.3;
      tx.current = Math.max(-38, Math.min(38, tx.current));
    }
    function onPointerUp() {
      isDragging = false;
      setDragging(false);
    }
    function onStageHoverMove(e: PointerEvent) {
      if (isDragging || isSpinning || !stage) return;
      const r = stage.getBoundingClientRect();
      ty.current = ((e.clientX - r.left) / r.width - 0.5) * 26;
      tx.current = -((e.clientY - r.top) / r.height - 0.5) * 20;
    }
    function onStageLeave() {
      if (!isSpinning) {
        tx.current = 0;
        ty.current = 0;
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') { ty.current -= 8; e.preventDefault(); }
      if (e.key === 'ArrowRight') { ty.current += 8; e.preventDefault(); }
      if (e.key === 'ArrowUp') { tx.current -= 6; e.preventDefault(); }
      if (e.key === 'ArrowDown') { tx.current += 6; e.preventDefault(); }
    }

    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointermove', onStageHoverMove);
    stage.addEventListener('pointerleave', onStageLeave);
    badge.addEventListener('keydown', onKeyDown);

    // Exposed on the DOM node so the toolbar buttons (plain React state/handlers
    // below) can flip the same mutable spin flag the rAF loop reads.
    (badge as any).__setSpinning = (v: boolean) => { isSpinning = v; };

    if (!reduceMotion) {
      rafId = requestAnimationFrame(loop);
    } else {
      apply();
    }

    return () => {
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointermove', onStageHoverMove);
      stage.removeEventListener('pointerleave', onStageLeave);
      badge.removeEventListener('keydown', onKeyDown);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  function toggleSpin() {
    const next = !spinning;
    setSpinning(next);
    (badgeRef.current as any)?.__setSpinning?.(next);
  }

  function reset() {
    setSpinning(false);
    (badgeRef.current as any)?.__setSpinning?.(false);
    tx.current = 0;
    ty.current = 0;
  }

  function shine() {
    const badge = badgeRef.current;
    if (!badge) return;
    badge.classList.remove('sweep');
    // Force a reflow so removing+re-adding the class restarts the CSS animation
    // even if a previous sweep is still playing.
    void badge.offsetWidth;
    badge.classList.add('sweep');
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={stageRef} style={{ perspective: 1400, touchAction: 'none' }}>
        <div
          ref={badgeRef}
          tabIndex={0}
          role="img"
          aria-label={label}
          onClick={shine}
          className={`relative emblem-badge emblem-float ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={
            {
              width: size,
              height: size,
              transformStyle: 'preserve-3d',
              transition: dragging ? 'none' : 'transform .5s cubic-bezier(.2,.7,.3,1)',
              '--glare-color': glareColor,
            } as React.CSSProperties
          }
        >
          <div className="absolute inset-0" style={{ transform: 'translateZ(-60px) scale(.94)', filter: 'blur(26px)', opacity: 0.75 }}>
            <div className="rounded-full bg-black" style={{ width: '78%', height: '78%', margin: '11% auto' }} />
          </div>
          <div className="absolute inset-0" style={{ transform: 'translateZ(0)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={plateSrc} alt="" className="w-full h-full" draggable={false} />
          </div>
          <div className="absolute inset-0" style={{ transform: 'translateZ(34px)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artSrc} alt="" className="w-full h-full" draggable={false} />
          </div>
          <div
            className="absolute inset-0 rounded-full pointer-events-none emblem-glare"
            style={{ transform: 'translateZ(46px)', mixBlendMode: 'screen' }}
          />
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none emblem-sheen-mask" style={{ transform: 'translateZ(50px)' }}>
            <span className="emblem-sheen-bar" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        <button
          type="button"
          onClick={toggleSpin}
          aria-pressed={spinning}
          className={`text-[11px] font-semibold uppercase tracking-wider px-4 py-2 rounded-full border transition ${
            spinning ? 'bg-emerald-500 text-gray-950 border-emerald-500' : 'bg-emerald-500/10 border-emerald-500/40 text-[#EFE9DE] hover:bg-emerald-500/20'
          }`}
        >
          Auto rotate
        </button>
        <button
          type="button"
          onClick={shine}
          className="text-[11px] font-semibold uppercase tracking-wider px-4 py-2 rounded-full border bg-emerald-500/10 border-emerald-500/40 text-[#EFE9DE] hover:bg-emerald-500/20 transition"
        >
          Shine
        </button>
        <button
          type="button"
          onClick={reset}
          className="text-[11px] font-semibold uppercase tracking-wider px-4 py-2 rounded-full border bg-emerald-500/10 border-emerald-500/40 text-[#EFE9DE] hover:bg-emerald-500/20 transition"
        >
          Reset
        </button>
      </div>
      <p className="text-[11px] text-[#96887A] text-center">Drag the emblem, or use arrow keys when focused.</p>
    </div>
  );
}
