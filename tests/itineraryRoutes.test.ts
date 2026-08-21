import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../src/backend/services/googleMapsService', () => ({ geocodeDestination: vi.fn() }));
vi.mock('../src/backend/services/paymentGateway', () => ({
  default: { initiateCheckout: vi.fn().mockResolvedValue({ orderId: 'order_test', amount: 4900, currency: 'INR', keyId: 'rzp_test' }) },
}));
const prismaMock = vi.hoisted(() => ({ itineraryUnlock: { create: vi.fn(), update: vi.fn() } }));
// Arrow-function implementations can't be invoked as constructors (Vitest 4
// throws "is not a constructor" when the route does `new PrismaClient()`),
// so this uses a plain function — matching the pattern used in
// tests/planRoutes.test.ts and tests/payoutSplit.test.ts.
vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(function () { return prismaMock; }) }));

import { geocodeDestination } from '../src/backend/services/googleMapsService';
import itineraryRoutes from '../src/backend/routes/itinerary.routes';

const app = express();
app.use(express.json());
app.use('/api', itineraryRoutes);

beforeEach(() => {
  vi.mocked(geocodeDestination).mockReset();
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

  it('accepts a free-text destination that geocodes successfully', async () => {
    vi.mocked(geocodeDestination).mockResolvedValueOnce({ placeName: 'Hampi, Karnataka, India', lat: 15.335, lng: 76.46 });
    prismaMock.itineraryUnlock.create.mockResolvedValueOnce({ id: 'unlock1' });
    prismaMock.itineraryUnlock.update.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/api/itineraries/unlock')
      .send({ destination: 'Hampi', customerName: 'A', customerEmail: 'a@b.com', customerPhone: '9999999999' });
    expect(res.status).toBe(201);
    expect(prismaMock.itineraryUnlock.create).toHaveBeenCalledOnce();
  });
});
