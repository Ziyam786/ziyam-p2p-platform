import { Request, Response, NextFunction } from 'express';
import { AuthService, AccessTokenPayload } from '../services/authService';
import { Role } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}

/** Requires a valid Bearer access token. Attaches the decoded payload to req.user. */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice('Bearer '.length);
  try {
    req.user = AuthService.verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Restricts access to one or more roles. Must run after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
