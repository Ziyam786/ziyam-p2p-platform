import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../src/backend/services/googleMapsService', () => ({ geocodeDestination: vi.fn(), isGoogleMapsConfigured: vi.fn() }));
vi.mock('../src/backend/services/paymentGateway', () => ({
  default: { initiateCheckout: vi.fn().mockResolvedValue({ orderId: 'order_test', amount: 4900, currency: 'INR', keyId: 'rzp_test' }) },
}));
const prismaMock = vi.hoisted(() => ({ itineraryUnlock: { create: vi.fn(), update: vi.fn() } }));
// Arrow-function implementations can't be invoked as constructors (Vitest 4
// throws "is not a constructor" when the route does `new PrismaClient()`),
// so this uses a plain function — matching the pattern used in
// tests/planRoutes.test.ts and tests/payoutSplit.test.ts.
vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(function () { return prismaMock; }) }));

import { geocodeDestination, isGoogleMapsConfigured } from '../src/backend/services/googleMapsService';
import itineraryRoutes from '../src/backend/routes/itinerary.routes';

const app = express();
app.use(express.json());
app.use('/api', itineraryRoutes);

beforeEach(() => {
  vi.mocked(geocodeDestination).mockReset();
  vi.mocked(isGoogleMapsConfigured).mockReset();
  // Configured by default — individual tests opt into the unconfigured
  // fail-open path explicitly.
  vi.mocked(isGoogleMapsConfigured).mockReturnValue(true);
  prismaMock.itineraryUnlock.create.mockReset();
  prismaMock.itineraryUnlock.update.mockReset();
});

describe('POST /itineraries/unlock', () => {
  it('rejects a destination that fails to geocode', async () => {
    vi.mocked(geocodeDestination).mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/itineraries/unlock')
      .send({ destination: 'asdkfjh', customerName: 'A', customerEmail: 'a@b.com', customerPhone: '9999999999' });
    expect(res.status).toBe(400);
    expect(prismaMock.itineraryUnlock.create).not.toHaveBeenCalled();
  });

  it('accepts a free-text destination that geocodes successfully, persisting the geocoded placeName', async () => {
    vi.mocked(geocodeDestination).mockResolvedValueOnce({ placeName: 'Hampi, Karnataka, India', lat: 15.335, lng: 76.46 });
    prismaMock.itineraryUnlock.create.mockResolvedValueOnce({ id: 'unlock1' });
    prismaMock.itineraryUnlock.update.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/api/itineraries/unlock')
      .send({ destination: 'Hampi', customerName: 'A', customerEmail: 'a@b.com', customerPhone: '9999999999' });
    expect(res.status).toBe(201);
    expect(prismaMock.itineraryUnlock.create).toHaveBeenCalledOnce();
    expect(prismaMock.itineraryUnlock.create.mock.calls[0][0].data.destination).toBe('Hampi, Karnataka, India');
  });

  it('rejects a non-string destination with 400 instead of hanging', async () => {
    const res = await request(app)
      .post('/api/itineraries/unlock')
      .send({ destination: 12345, customerName: 'A', customerEmail: 'a@b.com', customerPhone: '9999999999' });
    expect(res.status).toBe(400);
    expect(geocodeDestination).not.toHaveBeenCalled();
    expect(prismaMock.itineraryUnlock.create).not.toHaveBeenCalled();
  });

  it('rejects a destination longer than 120 characters', async () => {
    const res = await request(app)
      .post('/api/itineraries/unlock')
      .send({ destination: 'A'.repeat(121), customerName: 'A', customerEmail: 'a@b.com', customerPhone: '9999999999' });
    expect(res.status).toBe(400);
    expect(geocodeDestination).not.toHaveBeenCalled();
    expect(prismaMock.itineraryUnlock.create).not.toHaveBeenCalled();
  });

  it('rejects a request missing customer fields before ever calling geocodeDestination', async () => {
    const res = await request(app)
      .post('/api/itineraries/unlock')
      .send({ destination: 'Hampi' });
    expect(res.status).toBe(400);
    expect(geocodeDestination).not.toHaveBeenCalled();
  });

  it('fails open (skips the geocode check and accepts the raw destination) when Google Maps is not configured', async () => {
    vi.mocked(isGoogleMapsConfigured).mockReturnValue(false);
    prismaMock.itineraryUnlock.create.mockResolvedValueOnce({ id: 'unlock2' });
    prismaMock.itineraryUnlock.update.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/api/itineraries/unlock')
      .send({ destination: 'Some Random Place', customerName: 'A', customerEmail: 'a@b.com', customerPhone: '9999999999' });
    expect(res.status).toBe(201);
    expect(geocodeDestination).not.toHaveBeenCalled();
    expect(prismaMock.itineraryUnlock.create).toHaveBeenCalledOnce();
    expect(prismaMock.itineraryUnlock.create.mock.calls[0][0].data.destination).toBe('Some Random Place');
  });
});
