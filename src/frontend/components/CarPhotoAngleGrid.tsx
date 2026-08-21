'use client';

import React from 'react';
import Image from 'next/image';
import PlateBlurEditor from './PlateBlurEditor';
import { REQUIRED_CAR_ANGLES } from '../lib/carPhotoAngles';

type RequiredAngle = (typeof REQUIRED_CAR_ANGLES)[number];

const ANGLE_LABELS: Record<RequiredAngle, string> = {
  FRONT: 'Front',
  RIGHT: 'Right side',
  REAR: 'Rear',
  LEFT: 'Left side',
  INTERIOR_FRONT: 'Interior — dashboard',
  INTERIOR_REAR: 'Interior — back seats',
};

interface Photo { blurred: string; original: string; }

interface CarPhotoAngleGridProps {
  images: string[];
  originalImages: string[];
  imageAngles: string[];
  onChange: (next: { images: string[]; originalImages: string[]; imageAngles: string[] }) => void;
}

/**
 * Replaces the old free-form "add any photos" picker with 6 required,
 * labeled tiles — one per REQUIRED_CAR_ANGLES entry — reusing the same
 * plate-blur-then-add flow ConditionPhotoCapture.tsx already established
 * for trip photos, applied here to car-listing photos instead. Any photo
 * from before this feature shipped that isn't tagged to one of the 6
 * angles shows below as a separate "Other photos" section — visible and
 * removable, but new photos can only be added through the 6 labeled tiles.
 *
 * On every change the three output arrays are rebuilt from scratch in
 * REQUIRED_CAR_ANGLES order (tagged photos first, legacy photos after) —
 * never a naive append/filter — so images[0] is always the FRONT photo
 * whenever FRONT is filled, regardless of the order tiles were filled in.
 */
export default function CarPhotoAngleGrid({ images, originalImages, imageAngles, onChange }: CarPhotoAngleGridProps) {
  const anglePhotos: Partial<Record<RequiredAngle, Photo>> = {};
  const legacyPhotos: Photo[] = [];
  images.forEach((blurred, i) => {
    const original = originalImages[i] ?? '';
    const angle = imageAngles[i];
    if ((REQUIRED_CAR_ANGLES as readonly string[]).includes(angle) && !anglePhotos[angle as RequiredAngle]) {
      anglePhotos[angle as RequiredAngle] = { blurred, original };
    } else {
      legacyPhotos.push({ blurred, original });
    }
  });

  function rebuild(nextAnglePhotos: Partial<Record<RequiredAngle, Photo>>, nextLegacy: Photo[]) {
    const nextImages: string[] = [];
    const nextOriginals: string[] = [];
    const nextAngles: string[] = [];
    for (const angle of REQUIRED_CAR_ANGLES) {
      const photo = nextAnglePhotos[angle];
      if (photo) {
        nextImages.push(photo.blurred);
        nextOriginals.push(photo.original);
        nextAngles.push(angle);
      }
    }
    for (const photo of nextLegacy) {
      nextImages.push(photo.blurred);
      nextOriginals.push(photo.original);
      nextAngles.push('');
    }
    onChange({ images: nextImages, originalImages: nextOriginals, imageAngles: nextAngles });
  }

  function setAngle(angle: RequiredAngle, blurredUrl: string, originalUrl: string) {
    rebuild({ ...anglePhotos, [angle]: { blurred: blurredUrl, original: originalUrl } }, legacyPhotos);
  }

  function removeAngle(angle: RequiredAngle) {
    const next = { ...anglePhotos };
    delete next[angle];
    rebuild(next, legacyPhotos);
  }

  function removeLegacy(index: number) {
    rebuild(anglePhotos, legacyPhotos.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        All 6 angles are required. Each photo has its license plate blurred automatically — draw a box over the
        plate before it's added.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {REQUIRED_CAR_ANGLES.map((angle) => {
          const photo = anglePhotos[angle];
          return (
            <div key={angle} className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-600">{ANGLE_LABELS[angle]}</p>
              {photo ? (
                <div className="relative w-full aspect-square">
                  <Image src={photo.blurred} alt={ANGLE_LABELS[angle]} fill sizes="160px" className="rounded-lg object-cover border border-emerald-300" />
                  <button
                    type="button"
                    onClick={() => removeAngle(angle)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
                    aria-label={`Remove ${ANGLE_LABELS[angle]} photo`}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="border border-dashed border-gray-300 rounded-lg p-2">
                  <PlateBlurEditor onComplete={(blurredUrl, originalUrl) => setAngle(angle, blurredUrl, originalUrl)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {legacyPhotos.length > 0 && (
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Other photos (added before angle labels existed)
          </p>
          <div className="flex flex-wrap gap-3">
            {legacyPhotos.map((photo, i) => (
              <div key={photo.blurred + i} className="relative w-20 h-20">
                <Image src={photo.blurred} alt="Untagged car photo" fill sizes="80px" className="rounded-lg object-cover border border-gray-200" />
                <button
                  type="button"
                  onClick={() => removeLegacy(i)}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
