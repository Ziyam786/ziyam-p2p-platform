'use client';

import React, { useEffect, useRef, useState } from 'react';
import { loadMapsLibrary, loadMarkerLibrary, isGoogleMapsConfigured, GOOGLE_MAPS_MAP_ID } from '../lib/googleMapsElements';

export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export default function CarLocationMap({ latitude, longitude, label }: { latitude: number; longitude: number; label?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const configured = isGoogleMapsConfigured();

  useEffect(() => {
    if (!configured || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;

    Promise.all([loadMapsLibrary(), loadMarkerLibrary()])
      .then(([{ MapElement }, { AdvancedMarkerElement }]) => {
        if (cancelled) return;
        container.innerHTML = '';
        const mapEl = new MapElement({
          center: { lat: latitude, lng: longitude },
          zoom: 14,
          mapId: GOOGLE_MAPS_MAP_ID || undefined,
        });
        mapEl.style.width = '100%';
        mapEl.style.height = '100%';
        new AdvancedMarkerElement({ map: mapEl.innerMap, position: { lat: latitude, lng: longitude }, title: label ?? 'Car location' });
        container.appendChild(mapEl);
      })
      .catch((err) => {
        console.error('[CarLocationMap] failed to load:', err);
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [configured, latitude, longitude, label]);

  if (!configured || error) {
    return (
      <div className="w-full h-48 rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-400">
        Map unavailable{!configured ? " — Google Maps isn't configured." : '.'}
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-48 rounded-xl overflow-hidden bg-gray-100" />;
}
