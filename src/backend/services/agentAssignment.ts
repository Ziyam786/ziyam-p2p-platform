import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Picks the AGENT with the fewest currently-open (REQUESTED/CONFIRMED)
 * assignments — a simple least-loaded round robin so jobs spread evenly
 * across whoever is on duty. Returns null if no agents exist yet.
 */
export async function pickLeastLoadedAgent(): Promise<string | null> {
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', isSuspended: false },
    select: { id: true },
  });
  if (agents.length === 0) return null;

  const openCounts = await prisma.serviceRequest.groupBy({
    by: ['assignedAgentId'],
    where: { assignedAgentId: { in: agents.map((a) => a.id) }, status: { in: ['REQUESTED', 'CONFIRMED'] } },
    _count: { _all: true },
  });
  const loadByAgent = new Map(openCounts.map((c) => [c.assignedAgentId as string, c._count._all]));

  let best = agents[0].id;
  let bestLoad = loadByAgent.get(best) ?? 0;
  for (const agent of agents.slice(1)) {
    const load = loadByAgent.get(agent.id) ?? 0;
    if (load < bestLoad) {
      best = agent.id;
      bestLoad = load;
    }
  }
  return best;
}

/**
 * Same least-loaded round robin, but for guest/host dispute-support
 * requests (see DisputeSupportRequest) — a third, unrelated open-job queue.
 */
export async function pickLeastLoadedDisputeAgent(): Promise<string | null> {
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', isSuspended: false },
    select: { id: true },
  });
  if (agents.length === 0) return null;

  const openCounts = await prisma.disputeSupportRequest.groupBy({
    by: ['assignedAgentId'],
    where: { assignedAgentId: { in: agents.map((a) => a.id) }, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    _count: { _all: true },
  });
  const loadByAgent = new Map(openCounts.map((c) => [c.assignedAgentId as string, c._count._all]));

  let best = agents[0].id;
  let bestLoad = loadByAgent.get(best) ?? 0;
  for (const agent of agents.slice(1)) {
    const load = loadByAgent.get(agent.id) ?? 0;
    if (load < bestLoad) {
      best = agent.id;
      bestLoad = load;
    }
  }
  return best;
}

/**
 * Same least-loaded round robin as pickLeastLoadedAgent above, but for
 * walk-in ground-staff trips (OpsTrip) rather than guest-initiated wash
 * service requests — a separate open-job count since the two queues are
 * unrelated. "Finger-cross" is the ops team's own name for this random-among-
 * least-loaded assignment (see Car.fleetOnboardingStep's doc comment).
 */
export async function pickLeastLoadedOpsAgent(): Promise<string | null> {
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', isSuspended: false },
    select: { id: true },
  });
  if (agents.length === 0) return null;

  const openCounts = await prisma.opsTrip.groupBy({
    by: ['assignedAgentId'],
    where: { assignedAgentId: { in: agents.map((a) => a.id) }, status: { in: ['SCHEDULED', 'RUNNING'] } },
    _count: { _all: true },
  });
  const loadByAgent = new Map(openCounts.map((c) => [c.assignedAgentId as string, c._count._all]));

  let best = agents[0].id;
  let bestLoad = loadByAgent.get(best) ?? 0;
  for (const agent of agents.slice(1)) {
    const load = loadByAgent.get(agent.id) ?? 0;
    if (load < bestLoad) {
      best = agent.id;
      bestLoad = load;
    }
  }
  return best;
}
