import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole, attachUserIfPresent } from '../middleware/auth';
import { getSetting } from '../services/settingsService';
import { generateChatReply, ChatTurn } from '../services/aiService';

const router = Router();
const prisma = new PrismaClient();

const MAX_HISTORY_TURNS = 12;
const MAX_MESSAGE_LENGTH = 2000;

/** Simple in-memory sliding-window rate limit — fine for a single instance; move to Redis for multi-instance deploys. */
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 20 };
const hits = new Map<string, number[]>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  timestamps.push(now);
  hits.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT.max;
}

router.post('/ai/chat', attachUserIfPresent, async (req: Request, res: Response) => {
  const { sessionId, message } = req.body;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `message must be under ${MAX_MESSAGE_LENGTH} characters` });
  }

  const ip = req.ip ?? 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many messages — please slow down and try again in a few minutes.' });
  }

  const chatEnabled = await getSetting<boolean>('ai_chat_enabled', true);
  if (!chatEnabled) {
    return res.status(503).json({ error: 'The support assistant is temporarily disabled. Please contact support@ziyam.in.' });
  }

  const systemPrompt = await getSetting<string>('ai_chat_system_prompt');
  const userId = req.user?.userId ?? null;

  const priorLogs = await prisma.chatLog.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: MAX_HISTORY_TURNS,
  });
  const history: ChatTurn[] = priorLogs.map((l) => ({ role: l.role as 'user' | 'assistant', content: l.content }));
  history.push({ role: 'user', content: message });

  await prisma.chatLog.create({ data: { id: uuidv4(), sessionId, userId, role: 'user', content: message } });

  const reply = await generateChatReply(systemPrompt, history);

  await prisma.chatLog.create({ data: { id: uuidv4(), sessionId, userId, role: 'assistant', content: reply } });

  res.json({ success: true, reply });
});

router.get('/admin/ai/conversations', requireAuth, requireRole(Role.ADMIN), async (_req: Request, res: Response) => {
  const logs = await prisma.chatLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  const bySession = new Map<string, typeof logs>();
  for (const log of logs) {
    if (!bySession.has(log.sessionId)) bySession.set(log.sessionId, []);
    bySession.get(log.sessionId)!.push(log);
  }
  const conversations = Array.from(bySession.entries()).map(([sessionId, msgs]) => ({
    sessionId,
    messageCount: msgs.length,
    lastMessage: msgs[0]?.content ?? '',
    lastMessageAt: msgs[0]?.createdAt,
    userId: msgs.find((m) => m.userId)?.userId ?? null,
  }));
  res.json({ success: true, count: conversations.length, data: conversations });
});

router.get('/admin/ai/conversations/:sessionId', requireAuth, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  const messages = await prisma.chatLog.findMany({
    where: { sessionId: req.params.sessionId },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: messages });
});

export default router;
