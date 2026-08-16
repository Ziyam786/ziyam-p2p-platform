import rateLimit from 'express-rate-limit';

// Applies to login/signup/OTP-request — the endpoints attackers actually
// automate against (credential stuffing, OTP spam). Keyed by IP; account
// lockout (see auth.routes.ts) is the complementary per-account layer, since
// IP-based limiting alone doesn't stop a distributed attack against one
// specific account.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});
