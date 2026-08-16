import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * "Finger-crossed shuffle" — a genuine random draw among active fleet
 * operators, confirmed as the intended assignment model (a fair lottery, not
 * least-loaded routing like the wash-service agent assignment) when a host
 * opts a car into fleet management. Returns null if no fleet operators exist.
 */
export async function pickFleetOperator(): Promise<string | null> {
  const operators = await prisma.user.findMany({
    where: { role: 'FLEET_OPERATOR', isSuspended: false },
    select: { id: true },
  });
  if (operators.length === 0) return null;
  return operators[Math.floor(Math.random() * operators.length)].id;
}
