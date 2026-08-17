'use client';

import React, { useEffect, useRef, useState } from 'react';
import { bookingsApi } from '../lib/api';
import { useGoogleMaps } from '../lib/useGoogleMaps';
import { useToast } from './Toast';
import type { DeliveryLocation } from '../lib/types';

const HOST_UPDATE_INTERVAL_MS = 15000;
const GUEST_POLL_INTERVAL_MS = 8000;

// Host side: shares live GPS while driving the car over for doorstep
// delivery — same "driver's own phone reports position" mechanism Uber/
// Zepto/Zomato use, not vehicle hardware (most self-hosted cars don't have
// telematics installed; the backend prefers it when a car does).
export function HostDeliverySharePanel({ bookingId }: { bookingId: string }) {
  const { show } = useToast();
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastShared, setLastShared] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const latestPositionRef = useRef<GeolocationPosition | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function pushLatest() {
    const pos = latestPositionRef.current;
    if (!pos) return;
    try {
      await bookingsApi.shareDeliveryLocation(bookingId, pos.coords.latitude, pos.coords.longitude);
      setLastShared(new Date());
    } catch (err: any) {
      show(err.message ?? 'Failed to share location', 'error');
    }
  }

  function stopSharing() {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    watchIdRef.current = null;
    intervalRef.current = null;
    setSharing(false);
  }

  function startSharing() {
    if (!navigator.geolocation) {
      setError('Location services are not available on this device/browser.');
      return;
    }
    setError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        latestPositionRef.current = pos;
        // Push the first fix immediately rather than waiting a full interval.
        if (!lastShared) pushLatest();
      },
      (err) => setError(err.message || 'Could not get your location — check location permissions.'),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    intervalRef.current = setInterval(pushLatest, HOST_UPDATE_INTERVAL_MS);
    setSharing(true);
  }

  useEffect(() => () => stopSharing(), []);

  return (
    <div className="mt-6 border border-blue-200 bg-blue-50 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-bold text-gray-900">Doorstep delivery — live location</p>
          <p className="text-xs text-gray-600 mt-1">
            {sharing
              ? 'The guest can see your live location while you drive over.'
              : 'Share your live location so the guest can track you, like a delivery rider.'}
          </p>
          {lastShared && <p className="text-[11px] text-gray-500 mt-1">Last shared {lastShared.toLocaleTimeString()}</p>}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        <button
          onClick={sharing ? stopSharing : startSharing}
          className={`shrink-0 text-xs font-bold px-4 py-2.5 rounded-xl transition ${
            sharing ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {sharing ? '⏹ Stop Sharing' : '📍 Share Live Location'}
        </button>
      </div>
    </div>
  );
}

// Guest side: polls for the host's (or vehicle's) latest reported position
// and pans a live marker — kept as one persistent map instance rather than
// CarLocationMap's recreate-on-change pattern, since that would flicker on
// every poll tick here.
export function GuestDeliveryTracker({ bookingId }: { bookingId: string }) {
  const { loaded, configured } = useGoogleMaps();
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [checked, setChecked] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    function poll() {
      bookingsApi
        .deliveryLocation(bookingId)
        .then((res) => {
          if (!active) return;
          setLocation(res.data);
          setChecked(true);
        })
        .catch(() => active && setChecked(true));
    }
    poll();
    const interval = setInterval(poll, GUEST_POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [bookingId]);

  useEffect(() => {
    if (!loaded || !location || !mapRef.current) return;
    const google = (window as any).google;
    const position = { lat: location.latitude, lng: location.longitude };
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, { center: position, zoom: 14, disableDefaultUI: true, zoomControl: true });
      markerRef.current = new google.maps.Marker({ position, map: mapInstanceRef.current, title: 'Your car' });
    } else {
      markerRef.current.setPosition(position);
      mapInstanceRef.current.panTo(position);
    }
  }, [loaded, location]);

  if (!checked) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
      <h2 className="font-bold text-gray-900 mb-1">Track Your Delivery</h2>
      {!location ? (
        <p className="text-sm text-gray-500">Your host hasn't started sharing their location yet — check back shortly.</p>
      ) : !configured ? (
        <p className="text-sm text-gray-500">Live tracking is unavailable right now.</p>
      ) : (
        <>
          <div ref={mapRef} className="w-full h-56 rounded-xl overflow-hidden bg-gray-100" />
          <p className="text-xs text-gray-400 mt-2">
            {location.source === 'TELEMATICS' ? 'Live vehicle GPS' : "Host's live location"} · updated {new Date(location.updatedAt).toLocaleTimeString()}
          </p>
        </>
      )}
    </div>
  );
}
