'use client';

import React, { useEffect, useRef, useState } from 'react';
import { bookingsApi } from '../lib/api';
import { useGoogleMaps } from '../lib/useGoogleMaps';
import { useToast } from './Toast';
import { subscribeToDeliveryLocation } from '../lib/firebase';
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
export function GuestDeliveryTracker({ bookingId, hostName, hostAvatarUrl }: { bookingId: string; hostName?: string; hostAvatarUrl?: string | null }) {
  const { loaded, configured } = useGoogleMaps();
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [checked, setChecked] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // One initial REST fetch either way — real-time listener takes over from
  // there if it can attach; a fresh page load shouldn't wait on Firestore
  // just to show whatever the last known position was.
  useEffect(() => {
    let active = true;
    bookingsApi
      .deliveryLocation(bookingId)
      .then((res) => active && setLocation(res.data))
      .finally(() => active && setChecked(true));
    return () => {
      active = false;
    };
  }, [bookingId]);

  // Real-time first (subscribeToDeliveryLocation resolves to null if
  // Firebase isn't configured for this deployment); polling is the
  // fallback, not the default, so a configured deployment never double-fetches.
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    subscribeToDeliveryLocation(bookingId, (update) => {
      if (active) setLocation(update);
    }).then((unsub) => {
      if (!active) {
        unsub?.();
        return;
      }
      if (unsub) {
        unsubscribe = unsub;
      } else {
        const poll = () => bookingsApi.deliveryLocation(bookingId).then((res) => active && setLocation(res.data)).catch(() => {});
        interval = setInterval(poll, GUEST_POLL_INTERVAL_MS);
      }
    });

    return () => {
      active = false;
      unsubscribe?.();
      if (interval) clearInterval(interval);
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
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
      <div className="p-6 pb-4">
        <h2 className="font-bold text-gray-900 mb-1">Track Your Delivery</h2>
        {!location && <p className="text-sm text-gray-500">Your host hasn't started sharing their location yet — check back shortly.</p>}
        {location && !configured && <p className="text-sm text-gray-500">Live tracking is unavailable right now.</p>}
      </div>

      {location && configured && (
        <>
          <div ref={mapRef} className="w-full h-56 bg-gray-100" />
          <div className="flex items-center gap-3 px-6 py-4">
            <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0 overflow-hidden">
              {hostAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hostAvatarUrl} alt={hostName ?? 'Host'} className="w-full h-full object-cover" />
              ) : (
                (hostName ?? 'H').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 text-sm truncate">{hostName ?? 'Your host'} is on the way</p>
              <p className="text-xs text-gray-400">
                {location.source === 'TELEMATICS' ? 'Live vehicle GPS' : "Live location"} · updated {new Date(location.updatedAt).toLocaleTimeString()}
              </p>
            </div>
            <a href="#trip-chat" className="shrink-0 w-9 h-9 rounded-full bg-gray-900 hover:bg-black text-white flex items-center justify-center transition" aria-label="Message host">
              💬
            </a>
          </div>
        </>
      )}
    </div>
  );
}
