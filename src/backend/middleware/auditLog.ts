import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function recordAudit(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  meta?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: { adminId, action, targetType, targetId, meta: meta as Prisma.InputJsonValue },
    });
  } catch (error) {
    // Auditing must never block the underlying admin action.
    console.error('[AUDIT LOG] Failed to record entry:', error);
  }
}
