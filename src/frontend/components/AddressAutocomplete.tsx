'use client';

import React, { useEffect, useRef } from 'react';
import { createPlacePicker, isGoogleMapsConfigured, type PlacePicker } from '../lib/googleMapsElements';

export interface AddressSelection {
  address: string;
  latitude: number;
  longitude: number;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing an address…',
}: {
  value: string;
  onChange: (address: string) => void;
  onSelect: (selection: AddressSelection) => void;
  placeholder?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<PlacePicker | null>(null);
  const configured = isGoogleMapsConfigured();

  useEffect(() => {
    if (!configured || pickerRef.current) return;
    let cancelled = false;
    createPlacePicker().then((picker) => {
      if (cancelled || !containerRef.current) return;
      picker.placeholder = placeholder;
      picker.country = ['in'];
      picker.style.width = '100%';
      picker.style.setProperty('--gmpx-color-primary', '#183eeb');
      picker.style.setProperty('--gmpx-font-family-base', 'Manrope, sans-serif');
      picker.addEventListener('gmpx-placechange', () => {
        const place = picker.value;
        if (!place?.location) return;
        onSelect({
          address: place.formattedAddress ?? '',
          latitude: place.location.lat(),
          longitude: place.location.lng(),
        });
      });
      containerRef.current.appendChild(picker);
      pickerRef.current = picker;
    });
    // placeholder/country are set once at creation — onSelect/onChange are
    // captured by the listener above and don't need to reattach on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      cancelled = true;
    };
  }, [configured]);

  return (
    <div>
      <div ref={containerRef} />
      {/* PlacePicker owns its own input internally — it can't be prefilled with
          typed-but-unselected text, so the last confirmed address (this
          component's `value`) is shown as context instead of losing it on edit. */}
      {configured && value && <p className="text-xs text-gray-400 mt-1">Current: {value} — search above to change it.</p>}
      {!configured && <p className="text-xs text-gray-400 mt-1">Address autocomplete unavailable — Google Maps isn't configured.</p>}
    </div>
  );
}
