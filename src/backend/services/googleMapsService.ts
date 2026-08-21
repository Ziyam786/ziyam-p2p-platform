import axios from 'axios';
import { config } from '../config';

export const BENGALURU = { lat: 12.9716, lng: 77.5946 };

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACES_NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

export interface HotelSuggestion {
  name: string;
  rating: number | null;
  priceLevel: number | null;
  address: string;
}

/**
 * True when a server-side Google Maps API key is configured. Callers use
 * this to tell "not configured" apart from "configured but Google found
 * nothing" — geocodeDestination/findNearbyHotels collapse both into an
 * empty result (null / []) so their own callers never need to branch on
 * config, but routes that would otherwise blame the USER for a destination
 * that's unresolvable only because the key is missing need to tell the
 * difference (see itinerary.routes.ts and plan.routes.ts).
 */
export function isGoogleMapsConfigured(): boolean {
  return Boolean(config.googleMaps.serverApiKey);
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Minimal in-memory TTL cache for the two billed Google API calls below.
 * Places Nearby Search and Geocoding are metered per-request, and neither
 * destinations nor nearby lodging change meaningfully within a day, so a
 * process-local Map (no Redis/external cache needed at this scale) cuts
 * repeat-lookup cost. Keyed/evicted purely by timestamp comparison at read
 * time — no background sweep, no shared mutable iteration during a request,
 * so there's no race window like the stale-state bugs from Tasks 12/16.
 */
class TtlCache<V> {
  private readonly store = new Map<string, { value: V; expiresAt: number }>();

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    this.store.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  clear(): void {
    this.store.clear();
  }
}

const geocodeCache = new TtlCache<{ placeName: string; lat: number; lng: number } | null>();
const hotelsCache = new TtlCache<HotelSuggestion[]>();

/** Test-only escape hatch — lets tests get a clean cache between cases instead of colliding on shared lat/lng or query keys. Not used by any route/service code. */
export function __clearGoogleMapsCachesForTests(): void {
  geocodeCache.clear();
  hotelsCache.clear();
}

/** Groups nearby lookups to ~110m precision so slightly different clicks on the same area share a cache entry. */
function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Great-circle distance in km — an approximation of road distance, matching this site's existing "distances are approximate" framing. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Resolves free-text destination input to a real place. Never throws —
 * returns null on ZERO_RESULTS, any other non-OK status, or a request
 * failure, so the caller can render a friendly "couldn't find that place"
 * message instead of a 500.
 */
export async function geocodeDestination(query: string): Promise<{ placeName: string; lat: number; lng: number } | null> {
  if (!config.googleMaps.serverApiKey) return null;
  const cacheKey = query.trim().toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached !== undefined) return cached;
  try {
    const res = await axios.get(GEOCODE_URL, { params: { address: query, key: config.googleMaps.serverApiKey } });
    if (res.data.status !== 'OK' || !res.data.results?.[0]) return null;
    const top = res.data.results[0];
    const place = { placeName: top.formatted_address, lat: top.geometry.location.lat, lng: top.geometry.location.lng };
    // Only successful resolutions are cached — a ZERO_RESULTS or transient
    // failure shouldn't get pinned as "not found" for 24h.
    geocodeCache.set(cacheKey, place);
    return place;
  } catch (error) {
    // Log only the message — the raw AxiosError carries error.config.params.key
    // (the live Google Maps server API key used in the request query string),
    // and logging the whole object would write that key into application logs.
    console.error('[googleMapsService] geocodeDestination failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Real, currently-listed lodging near a destination via Places Nearby
 * Search. Never throws — returns an empty array on any failure so the
 * planner's hotel section can render its own "unavailable" state rather
 * than blocking the rest of the page (see spec's Error handling section).
 */
export async function findNearbyHotels(lat: number, lng: number): Promise<HotelSuggestion[]> {
  if (!config.googleMaps.serverApiKey) return [];
  const cacheKey = `${roundCoord(lat)},${roundCoord(lng)}`;
  const cached = hotelsCache.get(cacheKey);
  if (cached !== undefined) return cached;
  try {
    const res = await axios.get(PLACES_NEARBY_URL, {
      params: { location: `${lat},${lng}`, radius: 15000, type: 'lodging', key: config.googleMaps.serverApiKey },
    });
    if (res.data.status !== 'OK') return [];
    const hotels = (res.data.results ?? []).slice(0, 6).map((r: any) => ({
      name: r.name,
      rating: r.rating ?? null,
      priceLevel: r.price_level ?? null,
      address: r.vicinity ?? '',
    }));
    // Only a real result set is cached — an empty [] here means "Places
    // returned no lodging OR the call errored/non-OK", and we don't want a
    // transient failure pinned as "no hotels" for 24h.
    if (hotels.length > 0) hotelsCache.set(cacheKey, hotels);
    return hotels;
  } catch (error) {
    // Log only the message — see note in geocodeDestination's catch block:
    // the raw AxiosError carries the live API key in error.config.params.key.
    console.error('[googleMapsService] findNearbyHotels failed:', error instanceof Error ? error.message : error);
    return [];
  }
}
