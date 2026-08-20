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

// Baseline limiter for every other route — generous enough that no real
// user session hits it (well above normal browsing/booking traffic), but
// stops basic scraping/DoS against public endpoints like /cars search that
// authRateLimiter (auth-only) doesn't cover. Keyed by IP.
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});

// razorpayWebhook.routes.ts is deliberately mounted in server.ts ahead of
// cookieParser/CORS/apiRateLimiter (Razorpay's webhook is a real
// server-to-server POST from Razorpay's own infrastructure, with no cookies
// and an Origin header our strict CORS check would otherwise reject) —
// which also means it never passes through apiRateLimiter above, so it
// needs its own gate. Keyed by IP; 100/15min is well above what Razorpay's
// own webhook retries ever produce, while still bounding an unauthenticated,
// DB-touching public POST endpoint.
export const razorpayWebhookRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});
