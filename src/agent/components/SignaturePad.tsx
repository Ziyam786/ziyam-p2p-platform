'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface SignaturePadProps {
  /** Fired on pointer-up after each stroke with the current drawing as a PNG blob — the
   * parent decides when (or if) to actually upload it, e.g. once on final form submit. */
  onCapture: (blob: Blob) => void;
  /** Fired when the pad is cleared, so a parent can drop any previously-captured blob/URL. */
  onClear?: () => void;
  height?: number;
}

function getCanvasPoint(canvas: HTMLCanvasElement, e: React.PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

/** Canvas-based signature capture. Handles both mouse and touch via Pointer Events. */
export default function SignaturePad({ onCapture, onClear, height = 160 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const paintWhiteBackground = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function setup() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a';
      }
      paintWhiteBackground(canvas);
    }

    setup();
    window.addEventListener('resize', setup);
    return () => window.removeEventListener('resize', setup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const point = getCanvasPoint(canvas, e);
    lastPointRef.current = point;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + 0.01, point.y + 0.01);
      ctx.stroke();
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = getCanvasPoint(canvas, e);
    const ctx = canvas.getContext('2d');
    const last = lastPointRef.current;
    if (ctx && last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    lastPointRef.current = point;
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    setIsEmpty(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, 'image/png');
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (canvas) paintWhiteBackground(canvas);
    setIsEmpty(true);
    onClear?.();
  }

  return (
    <div>
      <div className="relative bg-white rounded-xl border border-slate-800 overflow-hidden touch-none" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {isEmpty && (
          <p className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none select-none">
            Sign here
          </p>
        )}
      </div>
      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={handleClear}
          className="text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-1.5 transition"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
