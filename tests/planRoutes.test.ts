import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../src/backend/services/googleMapsService', () => ({
  BENGALURU: { lat: 12.9716, lng: 77.5946 },
  geocodeDestination: vi.fn(),
  findNearbyHotels: vi.fn(),
  haversineKm: (a: any, b: any) => {
    // Real haversine so distance-based assertions below are meaningful.
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  },
}));

const prismaMock = vi.hoisted(() => ({ car: { findFirst: vi.fn() } }));
// Arrow-function implementations can't be invoked as constructors (Vitest 4
// throws "is not a constructor" when the route does `new PrismaClient()`),
// so this uses a plain function — matching the class-based pattern already
// used for the same mock in tests/payoutSplit.test.ts.
vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(function () { return prismaMock; }) }));

import { geocodeDestination } from '../src/backend/services/googleMapsService';
import planRoutes from '../src/backend/routes/plan.routes';

const app = express();
app.use(express.json());
app.use('/api', planRoutes);

beforeEach(() => {
  vi.mocked(geocodeDestination).mockReset();
});

describe('GET /plan/destination-check', () => {
  it('rejects a missing query param', async () => {
    const res = await request(app).get('/api/plan/destination-check');
    expect(res.status).toBe(400);
  });

  it('returns valid:false when geocoding finds nothing', async () => {
    vi.mocked(geocodeDestination).mockResolvedValueOnce(null);
    const res = await request(app).get('/api/plan/destination-check?q=asdkfjh');
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.reason).toMatch(/couldn't find/i);
  });

  it('returns valid:false when the destination is too far', async () => {
    vi.mocked(geocodeDestination).mockResolvedValueOnce({ placeName: 'Delhi, India', lat: 28.7041, lng: 77.1025 });
    const res = await request(app).get('/api/plan/destination-check?q=Delhi');
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.reason).toMatch(/far/i);
  });

  it('returns valid:true with distanceKm for a reasonable destination', async () => {
    vi.mocked(geocodeDestination).mockResolvedValueOnce({ placeName: 'Ooty, Tamil Nadu, India', lat: 11.4064, lng: 76.6932 });
    const res = await request(app).get('/api/plan/destination-check?q=Ooty');
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.placeName).toBe('Ooty, Tamil Nadu, India');
    // Real driving distance over ghat roads is ~250-270km, but haversineKm
    // computes straight-line great-circle distance, which for Bengaluru-Ooty
    // is genuinely ~200km (see tests/googleMapsService.test.ts for the same
    // discrepancy noted against the same city pair).
    expect(res.body.data.distanceKm).toBeGreaterThan(180);
    expect(res.body.data.distanceKm).toBeLessThan(220);
  });
});

describe('GET /plan/suggest-car', () => {
  it('returns the best-rated matching car with exactMatch:true', async () => {
    prismaMock.car.findFirst.mockResolvedValueOnce({
      id: 'car1', make: 'Mahindra', model: 'Thar', city: 'Bengaluru', category: 'SUV',
      dailyRate: 2499, seats: 4, transmission: 'MANUAL', fuelType: 'PETROL',
    });
    const res = await request(app).get('/api/plan/suggest-car?distanceKm=480&city=Bengaluru');
    expect(res.body.data.exactMatch).toBe(true);
    expect(res.body.data.car.make).toBe('Mahindra');
  });

  it('falls back to any available car with exactMatch:false when no category match exists', async () => {
    prismaMock.car.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'car2', make: 'Maruti', model: 'Swift', city: 'Bengaluru', category: 'Hatchback',
      dailyRate: 1499, seats: 5, transmission: 'MANUAL', fuelType: 'PETROL',
    });
    const res = await request(app).get('/api/plan/suggest-car?distanceKm=480&city=Bengaluru');
    expect(res.body.data.exactMatch).toBe(false);
    expect(res.body.data.car.make).toBe('Maruti');
  });

  it('returns car:null when nothing is available at all', async () => {
    prismaMock.car.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const res = await request(app).get('/api/plan/suggest-car?distanceKm=100&city=Bengaluru');
    expect(res.body.data.car).toBeNull();
  });
});
