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

// Roles this fine-grained layer actually governs. Everyone else (CUSTOMER,
// SELF_HOST, FLEET_OPERATOR) has their own row-level access model on these
// same routes (e.g. "only your own cars' ledger entries") that predates and
// is unrelated to CustomRole — requirePermission() is a no-op for them so it
// layers cleanly on top of an existing requireRole() gate without breaking it.
const CUSTOM_ROLE_GOVERNED: Role[] = ['FLEET_ADMIN', 'OPERATIONS_EXECUTIVE', 'MECHANICAL_EXECUTIVE', 'TECHNICIAN', 'AGENT'];

/**
 * Granular per-screen check for the "Who Can Do What" RBAC layer
 * (CustomRole.permissions), orthogonal to the coarse Role enum above. Loaded
 * fresh per-request — never assumed from the JWT, since permissions can be
 * edited live from the Team & Access screen and the token only carries
 * {userId, role}. ADMIN always passes. Internal-staff roles with no
 * CustomRole assigned are denied (fails closed).
 */
export function requirePermission(screen: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'ADMIN') return next();
    if (!CUSTOM_ROLE_GOVERNED.includes(req.user.role)) return next();

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { customRole: { select: { permissions: true } } },
    });
    const permissions = (user?.customRole?.permissions as Record<string, boolean> | undefined) ?? {};
    if (permissions[screen] !== true) {
      return res.status(403).json({ error: `You don't have access to ${screen}. Ask an admin to grant it from Team & Access.` });
    }
    next();
  };
}
