import { NextFunction, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { config } from '../config';
import { verifyAuthToken } from '../utils/jwt';

const prisma = new PrismaClient();

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { userId: string; role: Role };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[config.auth.cookieName];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = verifyAuthToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { isSuspended: true } });
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    if (user.isSuspended) return res.status(403).json({ error: 'This account has been suspended. Contact support@ziyam.in.' });

    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/** Attaches req.user if a valid session cookie exists, but does not reject the request otherwise. */
export function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[config.auth.cookieName];
  if (token) {
    try {
      const payload = verifyAuthToken(token);
      req.user = { userId: payload.userId, role: payload.role };
    } catch {
      // ignore invalid token, proceed unauthenticated
    }
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
