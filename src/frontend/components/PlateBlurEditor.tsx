'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { uploadsApi, ApiError } from '../lib/api';

interface PixelRect { left: number; top: number; width: number; height: number; }

// Below this pixel size, a drag is treated as an accidental click rather
// than a real box — keeps "Blur & Confirm" disabled until the host has
// actually drawn something over the plate.
const MIN_DRAG_PX = 6;

/**
 * Step 1: upload a raw car photo (becomes the admin-only "original").
 * Step 2: the host click-drags a rectangle over the license plate, tracked
 * in pixels relative to the rendered image's own bounding box.
 * Step 3: "Blur & Confirm" converts that rectangle to fractional [0,1]
 * coordinates (resolution-independent) and asks the backend to blur just
 * that region, producing a new "blurred" file. Both URLs are handed back
 * via onComplete so the caller can keep `images` (blurred) and
 * `originalImages` (unblurred) in lockstep by index.
 */
export default function PlateBlurEditor({ onComplete }: { onComplete: (blurredUrl: string, originalUrl: string) => void }) {
  const [originalUrl, setOriginalUrl] = useState('');
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [blurring, setBlurring] = useState(false);
  const [error, setError] = useState('');

  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(null);
  const [rectPx, setRectPx] = useState<PixelRect | null>(null);
  const [dragging, setDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function resetSelection() {
    setNatural(null);
    setRectPx(null);
    setDragOrigin(null);
    setDragging(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    resetSelection();
    try {
      const { url } = await uploadsApi.upload(file);
      setOriginalUrl(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function pointInContainer(clientX: number, clientY: number) {
    const bounds = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(clientX - bounds.left, 0), bounds.width),
      y: Math.min(Math.max(clientY - bounds.top, 0), bounds.height),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!natural) return; // wait for real dimensions before allowing a drag
    e.preventDefault();
    const p = pointInContainer(e.clientX, e.clientY);
    setDragOrigin(p);
    setRectPx({ left: p.x, top: p.y, width: 0, height: 0 });
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !dragOrigin) return;
    const p = pointInContainer(e.clientX, e.clientY);
    setRectPx({
      left: Math.min(dragOrigin.x, p.x),
      top: Math.min(dragOrigin.y, p.y),
      width: Math.abs(p.x - dragOrigin.x),
      height: Math.abs(p.y - dragOrigin.y),
    });
  }

  function stopDragging() {
    setDragging(false);
  }

  const hasBox = Boolean(rectPx && rectPx.width >= MIN_DRAG_PX && rectPx.height >= MIN_DRAG_PX);

  async function confirmBlur() {
    if (!rectPx || !hasBox || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    setBlurring(true);
    setError('');
    try {
      const { url: blurredUrl } = await uploadsApi.blurRegion(originalUrl, {
        x: rectPx.left / bounds.width,
        y: rectPx.top / bounds.height,
        width: rectPx.width / bounds.width,
        height: rectPx.height / bounds.height,
      });
      onComplete(blurredUrl, originalUrl);
      setOriginalUrl('');
      resetSelection();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to blur the plate. Please try again.');
    } finally {
      setBlurring(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
        id="plate-blur-upload"
        disabled={uploading}
      />
      <label
        htmlFor="plate-blur-upload"
        className={`inline-block text-xs font-semibold px-3 py-2 rounded-lg border cursor-pointer transition ${
          uploading ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait' : 'border-amber-500 text-amber-600 hover:bg-amber-50'
        }`}
      >
        {uploading ? 'Uploading…' : originalUrl ? 'Choose a different photo' : 'Add a photo'}
      </label>

      {originalUrl && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Click and drag a box over the license plate to blur it before adding this photo.</p>
          <div
            ref={containerRef}
            className="relative w-full max-w-md rounded-xl overflow-hidden border border-gray-200 bg-gray-100 select-none touch-none cursor-crosshair"
            style={{ aspectRatio: natural ? `${natural.width} / ${natural.height}` : '4 / 3' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerLeave={stopDragging}
          >
            <Image
              src={originalUrl}
              alt="Uploaded car photo — draw a box over the license plate"
              fill
              sizes="(max-width: 448px) 100vw, 448px"
              className="object-cover pointer-events-none"
              onLoad={(e) => {
                const img = e.currentTarget;
                setNatural({ width: img.naturalWidth, height: img.naturalHeight });
              }}
            />
            {rectPx && (
              <div
                className="absolute border-2 border-amber-500 bg-amber-500/30 pointer-events-none"
                style={{ left: rectPx.left, top: rectPx.top, width: rectPx.width, height: rectPx.height }}
              />
            )}
            {!natural && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">Loading photo…</div>
            )}
          </div>

          <button
            type="button"
            disabled={!hasBox || blurring}
            onClick={confirmBlur}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-amber-500 text-white transition hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {blurring ? 'Blurring…' : 'Blur & Confirm'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
