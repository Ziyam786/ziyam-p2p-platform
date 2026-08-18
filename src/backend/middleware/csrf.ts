import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';

export const CSRF_COOKIE_NAME = 'ziyam_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Issues a fresh double-submit CSRF token alongside the session cookie.
 * Deliberately NOT httpOnly — our own frontend JS reads it and echoes it
 * back as a request header, and that round trip is the entire mechanism.
 * It works even though the session cookie itself runs SameSite=None in
 * production (required since frontend/admin/agent are on separate origins
 * from the API, so SameSite offers this app no CSRF protection on its
 * own): forging the matching header requires reading this cookie's value
 * first, and a cross-origin attacker page cannot read another origin's
 * cookies, whether the request is a fetch or a plain HTML form POST.
 */
export function issueCsrfCookie(res: Response): void {
  const isHttps = config.serverUrl.startsWith('https://');
  res.cookie('ziyam_csrf', crypto.randomBytes(32).toString('hex'), {
    httpOnly: false,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Enforces the double-submit check on state-changing requests, but only
 * when a session cookie is actually present. Pre-login endpoints
 * (signup/login/OTP) have no session yet, so there's no authenticated
 * state to protect there; a future bearer-token client (mobile) isn't
 * cookie-based at all, so it isn't CSRF-exposed by construction — nothing
 * makes a browser attach an Authorization header on our behalf.
 */
export function requireCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.cookies?.[config.auth.cookieName]) return next();

  // Literal `ziyam_csrf` / `x-csrf-token` names so CodeQL's
  // js/missing-token-validation sees this as CSRF middleware (it does not
  // treat a locally named csrf() factory as csurf/lusca).
  const csrfToken = req.cookies?.ziyam_csrf;
  const headerToken = req.headers['x-csrf-token'];
  if (
    typeof csrfToken === 'string' &&
    csrfToken &&
    typeof headerToken === 'string' &&
    csrfToken === headerToken &&
    safeEqual(csrfToken, headerToken)
  ) {
    return next();
  }
  return res.status(403).json({ error: 'Missing or invalid CSRF token' });
}
