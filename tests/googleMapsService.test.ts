import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');
import axios from 'axios';
import { geocodeDestination, haversineKm, findNearbyHotels, BENGALURU } from '../src/backend/services/googleMapsService';

beforeEach(() => {
  vi.mocked(axios.get).mockReset();
});

describe('haversineKm', () => {
  it('computes the straight-line distance between Bengaluru and Ooty within 20km of the known ~200km great-circle figure', () => {
    // Note: ~200km is the great-circle (as-the-crow-flies) distance, not the
    // ~260-270km ghat-road driving distance between these two points.
    const ooty = { lat: 11.4064, lng: 76.6932 };
    const km = haversineKm(BENGALURU, ooty);
    expect(km).toBeGreaterThan(180);
    expect(km).toBeLessThan(220);
  });

  it('returns 0 for identical points', () => {
    expect(haversineKm(BENGALURU, BENGALURU)).toBe(0);
  });
});

describe('geocodeDestination', () => {
  it('returns placeName/lat/lng on a successful geocode', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [{ formatted_address: 'Ooty, Tamil Nadu, India', geometry: { location: { lat: 11.4064, lng: 76.6932 } } }],
      },
    });
    const result = await geocodeDestination('Ooty');
    expect(result).toEqual({ placeName: 'Ooty, Tamil Nadu, India', lat: 11.4064, lng: 76.6932 });
  });

  it('returns null when Google reports ZERO_RESULTS', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { status: 'ZERO_RESULTS', results: [] } });
    expect(await geocodeDestination('asdkfjhaslkdfj')).toBeNull();
  });

  it('returns null (not a throw) when the request itself fails', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('network error'));
    expect(await geocodeDestination('Ooty')).toBeNull();
  });
});

describe('findNearbyHotels', () => {
  it('maps Places results into HotelSuggestion shape', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [
          { name: 'Hotel A', rating: 4.2, price_level: 2, vicinity: 'Main Road, Ooty' },
          { name: 'Hotel B', rating: undefined, price_level: undefined, vicinity: 'Lake Road, Ooty' },
        ],
      },
    });
    const hotels = await findNearbyHotels(11.4064, 76.6932);
    expect(hotels).toEqual([
      { name: 'Hotel A', rating: 4.2, priceLevel: 2, address: 'Main Road, Ooty' },
      { name: 'Hotel B', rating: null, priceLevel: null, address: 'Lake Road, Ooty' },
    ]);
  });

  it('returns an empty array (not a throw) when the request fails', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('network error'));
    expect(await findNearbyHotels(11.4064, 76.6932)).toEqual([]);
  });
});
