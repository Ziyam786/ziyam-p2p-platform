'use client';

import React, { useEffect, useRef } from 'react';
import { useGoogleMaps } from '../lib/useGoogleMaps';

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
  const { loaded, error, configured } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;
    const google = (window as any).google;
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'in' },
      fields: ['formatted_address', 'geometry'],
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;
      onSelect({
        address: place.formatted_address ?? inputRef.current!.value,
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng(),
      });
    });
    autocompleteRef.current = autocomplete;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      {!configured && <p className="text-xs text-gray-400 mt-1">Address autocomplete unavailable — Google Maps isn't configured.</p>}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
