'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { EXTERIOR_SPIN_ORDER, type ExteriorAngle } from '../lib/carPhotoAngles';

// Pixels of horizontal drag before the viewer advances one frame — a plain
// snap-per-threshold-crossing interaction, not momentum/inertia physics
// (see the spec's "Out of scope" section for why: this is the first
// version, a follow-up can add velocity-based flicks).
const DRAG_THRESHOLD_PX = 40;

interface CarSpinViewerProps {
  images: string[];
  imageAngles: string[];
  alt: string;
  angle: ExteriorAngle;
  onAngleChange: (angle: ExteriorAngle) => void;
  className?: string;
  imgClassName?: string;
}

export default function CarSpinViewer({ images, imageAngles, alt, angle, onAngleChange, className, imgClassName }: CarSpinViewerProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  const dragAccumulator = useRef(0);
  const dragging = useRef(false);

  const angleToUrl: Partial<Record<ExteriorAngle, string>> = {};
  for (const spinAngle of EXTERIOR_SPIN_ORDER) {
    const idx = imageAngles.findIndex((a, i) => a === spinAngle && i < images.length);
    if (idx !== -1) angleToUrl[spinAngle] = images[idx];
  }
  const currentSrc = imgSrc ?? angleToUrl[angle] ?? '/placeholder-car.jpg';

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Reset the error-fallback override whenever the angle prop itself changes,
  // whether driven by this component's own advance() or by an external
  // caller (e.g. a thumbnail row) setting `angle` directly. Without this,
  // a placeholder shown for one angle would leak onto every subsequent
  // angle, since currentSrc's `imgSrc ??` check short-circuits before ever
  // looking at the new angle's real URL.
  useEffect(() => {
    setImgSrc(null);
  }, [angle]);

  function advance(direction: 1 | -1) {
    const currentIndex = EXTERIOR_SPIN_ORDER.indexOf(angle);
    const nextIndex = (currentIndex + direction + EXTERIOR_SPIN_ORDER.length) % EXTERIOR_SPIN_ORDER.length;
    onAngleChange(EXTERIOR_SPIN_ORDER[nextIndex]);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    dragAccumulator.current = 0;
    setShowHint(false);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragAccumulator.current += e.movementX;
    if (dragAccumulator.current >= DRAG_THRESHOLD_PX) {
      advance(1);
      dragAccumulator.current = 0;
    } else if (dragAccumulator.current <= -DRAG_THRESHOLD_PX) {
      advance(-1);
      dragAccumulator.current = 0;
    }
  }

  function handlePointerUp() {
    dragging.current = false;
    dragAccumulator.current = 0;
  }

  return (
    <div
      className={`relative touch-none select-none cursor-grab active:cursor-grabbing ${className ?? ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <Image
        src={currentSrc}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className={imgClassName}
        onError={() => setImgSrc('/placeholder-car.jpg')}
      />
      {showHint && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-black/60 text-white px-2.5 py-1 rounded-full pointer-events-none transition-opacity">
          ↔ Drag to spin
        </span>
      )}
    </div>
  );
}
