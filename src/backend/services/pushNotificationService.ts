import { PrismaClient } from '@prisma/client';
import type { SendResponse } from 'firebase-admin/messaging';
import { getMessagingClient, isFirebaseConfigured } from './firebaseAdmin';

const prisma = new PrismaClient();

/**
 * Fans a notification out to every device/browser token the user has
 * registered (see POST /users/me/push-token). Best-effort — never throws,
 * matching every other notification channel in this app (smsService.ts,
 * whatsappService.ts, emailService.ts, notify() itself). Prunes tokens
 * Firebase reports as dead so they stop being retried forever.
 */
export async function sendPushNotification(userId: string, title: string, body: string, link?: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    console.log(`[PUSH] (not configured — logged only) To user ${userId}: "${title}" — ${body}`);
    return;
  }

  const tokens = await prisma.pushToken.findMany({ where: { userId }, select: { id: true, token: true } });
  if (tokens.length === 0) return;

  try {
    const res = await getMessagingClient().sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title, body },
      webpush: link ? { fcmOptions: { link } } : undefined,
      data: link ? { link } : undefined,
    });

    const deadTokenIds: string[] = [];
    res.responses.forEach((r: SendResponse, i: number) => {
      if (!r.success && (r.error?.code === 'messaging/registration-token-not-registered' || r.error?.code === 'messaging/invalid-registration-token')) {
        deadTokenIds.push(tokens[i].id);
      }
    });
    if (deadTokenIds.length > 0) {
      await prisma.pushToken.deleteMany({ where: { id: { in: deadTokenIds } } });
    }
  } catch (err: any) {
    console.error('[PUSH] Send failed for user %s:', userId, err.message);
  }
}
