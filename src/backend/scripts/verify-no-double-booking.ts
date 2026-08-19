/**
 * Proves the fix in booking.routes.ts (POST /booking): two concurrent
 * requests for the same car and overlapping dates must not both succeed.
 * Before that fix, the overlap check ran as a plain `findFirst` outside
 * any transaction, so both requests could pass the check before either
 * committed — a real double-booking. See:
 *   specs/001-flutter-renter-app/research.md ("Decision: Car/listing &
 *   booking API — reuse as-is, with one required transaction fix")
 *   specs/001-flutter-renter-app/tasks.md T011/T012
 *
 * There is currently no test framework (jest/vitest/etc.) configured for
 * src/backend — this is a standalone, dependency-free script rather than
 * a "test" wired into a suite that doesn't exist yet. It creates its own
 * throwaway Car/User fixtures, spawns the real server on a scratch port,
 * fires the race, asserts the outcome, and deletes everything it created
 * — including on failure. Run with:
 *
 *   npx ts-node --transpile-only src/backend/scripts/verify-no-double-booking.ts
 *
 * Exits non-zero on any assertion failure or unexpected error. Point
 * DATABASE_URL at a disposable/dev database before running — it creates
 * and deletes real rows.
 */
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const PORT = Number(process.env.VERIFY_PORT ?? 5099);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const prisma = new PrismaClient();

async function waitForHealth(timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not become healthy on port ${PORT} within ${timeoutMs}ms`);
}

function startServer(): ChildProcess {
  const child = spawn(
    'npx',
    ['ts-node', '--transpile-only', 'src/backend/server.ts'],
    {
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
      // `npx` resolves to npx.cmd on Windows, which spawn() can't exec
      // directly without a shell — see https://github.com/nodejs/node/issues/52554.
      shell: process.platform === 'win32',
    },
  );
  child.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`));
  child.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`));
  return child;
}

async function createFixtures() {
  const host = await prisma.user.create({
    data: {
      id: randomUUID(),
      fullName: 'Verify Host',
      email: `verify-host-${randomUUID()}@example.invalid`,
      phoneNumber: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
      passwordHash: 'not-used',
      role: 'SELF_HOST',
      payoutAccountId: 'acct_verify_script',
      bankAccountVerified: true,
    },
  });

  const car = await prisma.car.create({
    data: {
      id: randomUUID(),
      ownerId: host.id,
      make: 'Verify',
      model: 'DoubleBookingCheck',
      registrationNo: `KA-VERIFY-${randomUUID().slice(0, 8)}`,
      year: 2024,
      category: 'Hatchback',
      fuelType: 'PETROL',
      transmission: 'MANUAL',
      dailyRate: 1000,
      city: 'Bengaluru',
      verificationStatus: 'VERIFIED',
      isAvailable: true,
    },
  });

  const customer = await prisma.user.create({
    data: {
      id: randomUUID(),
      fullName: 'Verify Customer',
      email: `verify-customer-${randomUUID()}@example.invalid`,
      phoneNumber: `8${Math.floor(100000000 + Math.random() * 899999999)}`,
      passwordHash: 'not-used',
      role: 'CUSTOMER',
      isKycVerified: true,
      isDrivingLicenseVerified: true,
    },
  });

  return { host, car, customer };
}

async function cleanupFixtures(ids: { hostId: string; carId: string; customerId: string; bookingIds: string[] }) {
  await prisma.booking.deleteMany({ where: { id: { in: ids.bookingIds } } });
  await prisma.car.deleteMany({ where: { id: ids.carId } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.hostId, ids.customerId] } } });
}

async function signInAs(customerId: string): Promise<string> {
  // Mint a real, valid session JWT the same way login does, bypassing
  // password auth entirely — this script isn't testing login, just the
  // booking-creation race, so a direct token mint keeps the fixture setup
  // minimal. Uses the backend's own signing function so the token is
  // indistinguishable from a real login's.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { signAuthToken } = require('../utils/jwt');
  return signAuthToken({ userId: customerId, role: 'CUSTOMER' });
}

async function attemptBooking(token: string, carId: string, startTime: string, endTime: string) {
  const res = await fetch(`${BASE_URL}/api/booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ carId, startTime, endTime, totalAmount: 3000 }),
  });
  const body = (await res.json().catch(() => ({}))) as { bookingId?: string; error?: string };
  return { status: res.status, body };
}

async function main() {
  console.log('Creating fixtures...');
  const { host, car, customer } = await createFixtures();
  const bookingIds: string[] = [];
  let server: ChildProcess | null = null;

  try {
    server = startServer();
    console.log(`Waiting for server on port ${PORT}...`);
    await waitForHealth();

    const token = await signInAs(customer.id);
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

    console.log('Firing two concurrent overlapping booking requests...');
    const [a, b] = await Promise.all([
      attemptBooking(token, car.id, start, end),
      attemptBooking(token, car.id, start, end),
    ]);

    for (const r of [a, b]) {
      if (r.status === 201 && typeof r.body?.bookingId === 'string') bookingIds.push(r.body.bookingId);
    }

    const successCount = [a, b].filter((r) => r.status === 201).length;
    const conflictCount = [a, b].filter((r) => r.status === 409).length;

    console.log('Result A:', a.status, a.body);
    console.log('Result B:', b.status, b.body);

    if (successCount !== 1) {
      throw new Error(`Expected exactly 1 of 2 concurrent overlapping bookings to succeed, got ${successCount}`);
    }
    if (conflictCount !== 1) {
      throw new Error(`Expected exactly 1 of 2 concurrent overlapping bookings to be rejected with 409, got ${conflictCount}`);
    }

    console.log('✅ PASS: exactly one of two concurrent overlapping bookings succeeded; the other was rejected with 409.');
  } finally {
    server?.kill();
    await cleanupFixtures({ hostId: host.id, carId: car.id, customerId: customer.id, bookingIds });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ FAIL:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
