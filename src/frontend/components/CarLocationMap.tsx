'use client';

import React, { useEffect, useRef } from 'react';
import { useGoogleMaps } from '../lib/useGoogleMaps';

export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export default function CarLocationMap({ latitude, longitude, label }: { latitude: number; longitude: number; label?: string }) {
  const { loaded, configured } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const google = (window as any).google;
    const center = { lat: latitude, lng: longitude };
    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      disableDefaultUI: true,
      zoomControl: true,
    });
    new google.maps.Marker({ position: center, map, title: label ?? 'Car location' });
  }, [loaded, latitude, longitude, label]);

  if (!configured) {
    return (
      <div className="w-full h-48 rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-400">
        Map unavailable — Google Maps isn't configured.
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-48 rounded-xl overflow-hidden bg-gray-100" />;
}
