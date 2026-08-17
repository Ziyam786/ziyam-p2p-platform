'use client';

import React, { useState } from 'react';
import { bookingsApi, uploadsApi } from '../lib/api';
import { useToast } from './Toast';
import type { PhotoAngle, TripStage } from '../lib/types';

const REQUIRED_ANGLES: { angle: PhotoAngle; label: string }[] = [
  { angle: 'FRONT', label: 'Front' },
  { angle: 'REAR', label: 'Rear' },
  { angle: 'LEFT', label: 'Left side' },
  { angle: 'RIGHT', label: 'Right side' },
];

const OPTIONAL_ANGLES: { angle: PhotoAngle; label: string }[] = [
  { angle: 'MIRROR_LEFT', label: 'Left mirror' },
  { angle: 'MIRROR_RIGHT', label: 'Right mirror' },
  { angle: 'ODOMETER', label: 'Odometer' },
];

export default function ConditionPhotoCapture({
  bookingId,
  stage,
  onComplete,
  onCancel,
}: {
  bookingId: string;
  stage: TripStage;
  onComplete: () => void;
  onCancel?: () => void;
}) {
  const { show } = useToast();
  const [photos, setPhotos] = useState<Partial<Record<PhotoAngle, string>>>({});
  const [uploadingAngle, setUploadingAngle] = useState<PhotoAngle | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const missingRequired = REQUIRED_ANGLES.filter((a) => !photos[a.angle]);
  const requiredDone = missingRequired.length === 0;

  async function handleFile(angle: PhotoAngle, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAngle(angle);
    try {
      const { url } = await uploadsApi.upload(file);
      setPhotos((prev) => ({ ...prev, [angle]: url }));
    } catch (err: any) {
      show(err.message ?? 'Photo upload failed', 'error');
    } finally {
      setUploadingAngle(null);
      e.target.value = '';
    }
  }

  async function submit() {
    if (!requiredDone) return;
    setSubmitting(true);
    try {
      const entries = Object.entries(photos) as [PhotoAngle, string][];
      await bookingsApi.uploadConditionPhotos(
        bookingId,
        stage,
        entries.map(([angle, url]) => ({ angle, url }))
      );
      onComplete();
    } catch (err: any) {
      show(err.message ?? 'Failed to save photos', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const tiles = [...REQUIRED_ANGLES, ...OPTIONAL_ANGLES];

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl p-5 space-y-4">
      <div>
        <p className="font-bold text-gray-900">{stage === 'PRE_TRIP' ? 'Pickup' : 'Drop-off'} condition photos</p>
        <p className="text-xs text-gray-600 mt-1">
          Required before you can {stage === 'PRE_TRIP' ? 'start' : 'complete'} this trip — front, rear, left, and
          right are mandatory so both sides have proof of the car's condition. Mirrors and odometer are optional
          but recommended.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(({ angle, label }) => {
          const required = REQUIRED_ANGLES.some((a) => a.angle === angle);
          const url = photos[angle];
          return (
            <label
              key={angle}
              className={`relative flex flex-col items-center justify-center gap-1 aspect-square rounded-lg border-2 border-dashed cursor-pointer overflow-hidden transition ${
                url ? 'border-emerald-400 bg-white' : 'border-gray-300 bg-white/60 hover:border-amber-400'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={uploadingAngle === angle}
                onChange={(e) => handleFile(angle, e)}
              />
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <>
                  <span className="text-xl">{uploadingAngle === angle ? '⏳' : '📷'}</span>
                  <span className="text-[11px] font-semibold text-gray-600 text-center px-1">
                    {label}
                    {required && ' *'}
                  </span>
                </>
              )}
              {url && (
                <span className="absolute top-1 right-1 text-[10px] font-bold bg-emerald-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                  ✓
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-2">
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={!requiredDone || submitting || uploadingAngle !== null}
          onClick={submit}
          className="text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-950 px-5 py-2.5 rounded-xl transition"
        >
          {submitting ? 'Saving…' : requiredDone ? 'Continue' : `${missingRequired.length} more required`}
        </button>
      </div>
    </div>
  );
}
