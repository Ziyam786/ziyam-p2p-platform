'use client';

import React, { useEffect, useRef } from 'react';
import { useGoogleMaps } from '../lib/useGoogleMaps';

// Matches BENGALURU in src/backend/services/googleMapsService.ts — every
// trip on this planner originates here, same fact already hardcoded as
// display text ("Bengaluru → …") on the plan page itself.
const BENGALURU = { lat: 12.9716, lng: 77.5946 };

export default function PlanRouteMap({ destination }: { destination: { placeName: string; lat: number; lng: number } }) {
  const { loaded, error, configured } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const google = (window as any).google;
    const dest = { lat: destination.lat, lng: destination.lng };

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, { disableDefaultUI: true, zoomControl: true });
    }
    const map = mapInstanceRef.current;

    new google.maps.Marker({ position: BENGALURU, map, title: 'Bengaluru', label: 'A' });
    new google.maps.Marker({ position: dest, map, title: destination.placeName, label: 'B' });

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(BENGALURU);
    bounds.extend(dest);
    map.fitBounds(bounds, 48);
  }, [loaded, destination.lat, destination.lng, destination.placeName]);

  if (!configured || error) return null;

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-gray-50">
      <div ref={mapRef} className="w-full h-48" />
      {!loaded && <p className="text-xs text-gray-400 text-center py-2">Loading route map…</p>}
    </div>
  );
}
