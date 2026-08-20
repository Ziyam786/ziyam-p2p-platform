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
  try {
    const res = await axios.get(GEOCODE_URL, { params: { address: query, key: config.googleMaps.serverApiKey } });
    if (res.data.status !== 'OK' || !res.data.results?.[0]) return null;
    const top = res.data.results[0];
    return { placeName: top.formatted_address, lat: top.geometry.location.lat, lng: top.geometry.location.lng };
  } catch (error) {
    console.error('[googleMapsService] geocodeDestination failed:', error);
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
  try {
    const res = await axios.get(PLACES_NEARBY_URL, {
      params: { location: `${lat},${lng}`, radius: 15000, type: 'lodging', key: config.googleMaps.serverApiKey },
    });
    if (res.data.status !== 'OK') return [];
    return (res.data.results ?? []).slice(0, 6).map((r: any) => ({
      name: r.name,
      rating: r.rating ?? null,
      priceLevel: r.price_level ?? null,
      address: r.vicinity ?? '',
    }));
  } catch (error) {
    console.error('[googleMapsService] findNearbyHotels failed:', error);
    return [];
  }
}
