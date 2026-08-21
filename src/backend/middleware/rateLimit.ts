import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

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

// Every KYC route below calls a METERED third-party API — Setu DigiLocker,
// Setu Aadhaar OTP, and the Arya suite (document extraction, liveness,
// deepfake, face match, Aadhaar masking). Each call costs real money per
// request, so an unthrottled KYC endpoint is a direct billing-abuse vector,
// not just a DoS one: an authenticated attacker with one valid account can
// burn the KYC budget without ever completing a verification.
//
// Keyed by authenticated user id (falling back to IP for the unauthenticated
// case, which requireAuth should already have rejected) rather than IP alone
// — KYC is always behind requireAuth, and per-user is the dimension that
// actually bounds spend. 15 attempts/hour is far above any honest flow: a
// real user submits a document, a selfie, and a DL, retrying a few times at
// worst.
export const kycRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as { user?: { id?: string } }).user?.id ?? ipKeyGenerator(req.ip ?? ''),
  message: {
    error: 'Too many verification attempts. Please try again in an hour, or contact support if you are stuck.',
  },
});

// /plan/destination-check and /plan/hotels (plan.routes.ts) each call a
// METERED third-party Google API — Geocoding and Places Nearby Search
// respectively (Places is ~$32/1000 requests). Same reasoning as
// kycRateLimiter above: an unthrottled endpoint calling a billed external
// API is a direct billing-abuse vector, not just a DoS one. These routes are
// public/unauthenticated (unlike KYC), so this is keyed by IP alone. 30
// requests/15min/IP is generous for a genuine trip-planning session (a
// handful of destination checks plus a hotel load per destination) while
// still bounding spend from any single source. Deliberately NOT applied to
// /plan/suggest-car, which only queries our own DB and doesn't call a paid API.
export const planRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});
