import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!config.ai.anthropicApiKey) return null;
  if (!client) client = new Anthropic({ apiKey: config.ai.anthropicApiKey });
  return client;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

// How many tool-call round-trips a single reply may take before we just
// answer with whatever we've got — bounds cost/latency on a support chatbot
// that should never spiral into a long autonomous loop.
const MAX_TOOL_ROUNDS = 4;

// Read-only tools the assistant can call to ground its answers in real data
// instead of guessing at inventory or booking status. Deliberately no
// booking/cancellation/payment tools here — this grounds answers, it doesn't
// act on the user's behalf.
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_available_cars',
    description:
      "Search Ziyam's live car listings. Use this whenever a user asks what cars are available, in a given city, category, or price range — never guess at inventory or prices.",
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name, e.g. "Bengaluru"' },
        category: { type: 'string', description: 'e.g. "SUV", "Sedan", "Hatchback"' },
        maxDailyRate: { type: 'number', description: 'Maximum rupees per day the user wants to pay' },
        startDate: { type: 'string', description: 'ISO date — only if the user gave specific trip dates' },
        endDate: { type: 'string', description: 'ISO date — only if the user gave specific trip dates' },
      },
    },
  },
  {
    name: 'get_my_bookings',
    description:
      "Look up the signed-in user's own bookings (status, dates, car, refund/rejection reason if any). Use this when a logged-in user asks about a trip they've booked. Returns an error if nobody is signed in.",
    input_schema: { type: 'object', properties: {} },
  },
];

async function searchAvailableCars(input: any) {
  const { city, category, maxDailyRate, startDate, endDate } = input ?? {};
  const candidates = await prisma.car.findMany({
    where: {
      isAvailable: true,
      verificationStatus: 'VERIFIED',
      ...(city && { city: { equals: String(city), mode: 'insensitive' as const } }),
      ...(category && { category: { equals: String(category), mode: 'insensitive' as const } }),
      ...(maxDailyRate && { dailyRate: { lte: Number(maxDailyRate) } }),
    },
    select: {
      id: true, make: true, model: true, city: true, category: true, dailyRate: true, seats: true, transmission: true, fuelType: true,
      reviews: { where: { hidden: false }, select: { rating: true } },
    },
    take: 20,
  });

  // Car has no stored rating column — it's a live average over Review rows,
  // same computation car.routes.ts uses for the public listing (withRatingSummary).
  const cars = candidates
    .map(({ reviews, ...rest }) => {
      const rating = reviews.length === 0 ? 0 : Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1));
      return { ...rest, rating };
    })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 8);

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const datesValid = Boolean(start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()));

  let conflictingCarIds = new Set<string>();
  if (datesValid && cars.length > 0) {
    // Same overlap check used at actual booking time (booking.routes.ts) —
    // a car with isAvailable=true can still be booked for the requested window.
    const conflicts = await prisma.booking.findMany({
      where: {
        carId: { in: cars.map((c) => c.id) },
        status: { notIn: ['CANCELLED', 'REJECTED'] },
        startTime: { lt: end! },
        endTime: { gt: start! },
      },
      select: { carId: true },
    });
    conflictingCarIds = new Set(conflicts.map((c) => c.carId));
  }

  const results = cars.filter((c) => !conflictingCarIds.has(c.id)).map(({ id, ...rest }) => rest);
  return { count: results.length, cars: results };
}

async function getMyBookings(userId: string | null) {
  if (!userId) return { error: 'No signed-in user — ask them to log in to check their bookings.' };
  const bookings = await prisma.booking.findMany({
    where: { customerId: userId },
    include: { car: { select: { make: true, model: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  return {
    count: bookings.length,
    bookings: bookings.map((b) => ({
      car: `${b.car.make} ${b.car.model}`,
      status: b.status,
      startTime: b.startTime,
      endTime: b.endTime,
      rejectionReason: b.rejectionReason,
      cancellationReason: b.cancellationReason,
    })),
  };
}

async function runTool(name: string, input: unknown, userId: string | null): Promise<unknown> {
  if (name === 'search_available_cars') return searchAvailableCars(input);
  if (name === 'get_my_bookings') return getMyBookings(userId);
  return { error: `Unknown tool: ${name}` };
}

/**
 * Calls Claude with the given system prompt and conversation history, giving
 * it real read-only tools (see TOOLS above) so it can ground answers about
 * inventory/pricing/booking status in the live database instead of guessing.
 * Returns a friendly fallback message instead of throwing if no API key is
 * configured yet — same "stub the unavailable external service" pattern as
 * paymentGateway.ts / telematicsService.ts.
 */
export async function generateChatReply(
  systemPrompt: string,
  history: ChatTurn[],
  opts: { userId?: string | null; enableTools?: boolean } = {}
): Promise<string> {
  const { userId = null, enableTools = false } = opts;
  const anthropic = getClient();
  if (!anthropic) {
    return (
      "I'm not fully set up yet — the site owner needs to add an ANTHROPIC_API_KEY " +
      'before I can answer questions. In the meantime, reach a human at support@ziyam.in.'
    );
  }

  try {
    const messages: Anthropic.MessageParam[] = history.map((turn) => ({ role: turn.role, content: turn.content }));

    for (let round = 0; round < (enableTools ? MAX_TOOL_ROUNDS : 1); round++) {
      const response = await anthropic.messages.create({
        model: config.ai.model,
        max_tokens: 512,
        system: systemPrompt,
        messages,
        ...(enableTools && { tools: TOOLS }),
      });

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find((block) => block.type === 'text');
        return textBlock && textBlock.type === 'text'
          ? textBlock.text
          : "Sorry, I couldn't generate a response. Please try again or contact support@ziyam.in.";
      }

      messages.push({ role: 'assistant', content: response.content });
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => ({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: JSON.stringify(await runTool(block.name, block.input, userId)),
        }))
      );
      messages.push({ role: 'user', content: toolResults });
    }

    return "I looked into a few things but couldn't pin down a full answer — please contact support@ziyam.in for help.";
  } catch (error: any) {
    console.error('[AI SERVICE] Anthropic call failed:', error.message ?? error);
    return "I'm having trouble reaching the AI service right now. Please try again shortly, or contact support@ziyam.in.";
  }
}
