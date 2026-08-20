import type { PlacePicker } from '@googlemaps/extended-component-library/place_picker.js';

export type { PlacePicker };

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
export const GOOGLE_MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? '';

let loaderEl: HTMLElement | null = null;
let registerPromise: Promise<typeof import('@googlemaps/extended-component-library/api_loader.js')> | null = null;

/**
 * These custom elements register themselves via customElements.define() as
 * a module side effect the instant they're imported — which crashes under
 * Next.js's server-side render pass (no HTMLElement/customElements in
 * Node). Every caller below must go through this lazy, browser-only import
 * instead of a static top-level one.
 */
function registerElements() {
  if (!registerPromise) {
    registerPromise = Promise.all([
      import('@googlemaps/extended-component-library/api_loader.js'),
      import('@googlemaps/extended-component-library/place_picker.js'),
    ]).then(([apiLoaderModule]) => apiLoaderModule);
  }
  return registerPromise;
}

/**
 * Ensures exactly one <gmpx-api-loader> exists in the document — required
 * once per page for the gmp-map/gmp-advanced-marker/gmpx-place-picker
 * elements below to work at all (see APILoader.importLibrary). Idempotent
 * across repeated calls/mounts, unlike creating one per consuming component.
 */
async function ensureApiLoader(): Promise<typeof import('@googlemaps/extended-component-library/api_loader.js')> {
  const mod = await registerElements();
  if (!loaderEl) {
    loaderEl = document.createElement('gmpx-api-loader');
    (loaderEl as unknown as { apiKey: string }).apiKey = API_KEY;
    document.body.appendChild(loaderEl);
  }
  return mod;
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(API_KEY);
}

/** Loads the "maps" library (google.maps.Map, google.maps.MapElement). */
export async function loadMapsLibrary(): Promise<google.maps.MapsLibrary> {
  const { APILoader } = await ensureApiLoader();
  return APILoader.importLibrary('maps') as Promise<google.maps.MapsLibrary>;
}

/** Loads the "marker" library (google.maps.marker.AdvancedMarkerElement). */
export async function loadMarkerLibrary(): Promise<google.maps.MarkerLibrary> {
  const { APILoader } = await ensureApiLoader();
  return APILoader.importLibrary('marker') as Promise<google.maps.MarkerLibrary>;
}

/** Creates a <gmpx-place-picker> element, ensuring the loader exists first. */
export async function createPlacePicker(): Promise<PlacePicker> {
  await ensureApiLoader();
  return document.createElement('gmpx-place-picker') as unknown as PlacePicker;
}
