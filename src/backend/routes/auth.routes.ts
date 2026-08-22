import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { randomInt, randomUUID } from 'crypto';
import { config } from '../config';
import { hashPassword, comparePassword } from '../utils/password';
import { signAuthToken } from '../utils/jwt';
import { requireAuth } from '../middleware/auth';
import { requestOtp, verifyOtp } from '../services/otpService';
import { authRateLimiter } from '../middleware/rateLimit';
import { issueCsrfCookie, CSRF_COOKIE_NAME } from '../middleware/csrf';
import { normalizeEmail, isValidEmail, normalizePhone, isValidPhone, normalizeFullName } from '../utils/validation';
import { verifyCredentials } from '@supabase/server/core';
import { isFirebaseConfigured, getAuthClient, mintFirebaseCustomToken } from '../services/firebaseAdmin';

const router = Router();
const prisma = new PrismaClient();

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// A real bcrypt hash of a value nobody will ever type, used to run a dummy
// comparePassword() when the email doesn't match any account. bcrypt.compare
// takes tens of milliseconds regardless of the hash it's checking against —
// skipping it for a nonexistent user (the naive `!user || ...` short-circuit)
// makes that lookup measurably faster than a real wrong-password attempt,
// which leaks account existence through response timing even though the
// error message itself is identical either way.
const DUMMY_PASSWORD_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8xNzO8HG7YfEC/kFO.wqAT1WYUXt6a';

const PUBLIC_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  role: true,
  isKycVerified: true,
  isDrivingLicenseVerified: true,
  isSelfieVerified: true,
  isSuspended: true,
  avatarUrl: true,
  bio: true,
  payoutAccountId: true,
  bankAccountNumber: true,
  bankIfsc: true,
  bankNameAtBank: true,
  bankAccountVerified: true,
  panNumber: true,
  panCategory: true,
  isPanVerified: true,
  signatureUrl: true,
  selfieUrl: true,
  alternatePhoneNumber: true,
  referralCode: true,
  creditsBalance: true,
  createdAt: true,
};

/** Picks the same field allowlist as PUBLIC_USER_SELECT off an already-fetched full User row — used where the row had to be fetched unfiltered for auth logic (passwordHash, lockout fields) but the response must not leak those internal fields. */
function toPublicUser<T extends Record<string, unknown>>(user: T): Pick<T, keyof typeof PUBLIC_USER_SELECT> {
  const picked = {} as Pick<T, keyof typeof PUBLIC_USER_SELECT>;
  for (const key of Object.keys(PUBLIC_USER_SELECT) as (keyof typeof PUBLIC_USER_SELECT)[]) {
    picked[key] = user[key] as any;
  }
  return picked;
}

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode() {
  let out = '';
  for (let i = 0; i < 4; i++) out += REFERRAL_ALPHABET[randomInt(REFERRAL_ALPHABET.length)];
  return out;
}

/** Generates a short, human-shareable referral code, retrying on the rare collision. */
async function generateUniqueReferralCode(fullName: string): Promise<string> {
  const base = (fullName.split(' ')[0] || 'ZIYAM').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'ZIYAM';
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `${base}${randomCode()}`;
    const clash = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!clash) return code;
  }
  return `${base}${Date.now().toString(36).toUpperCase()}`;
}

function cookieOptions() {
  // Deliberately keyed off whether the server is actually reachable over
  // HTTPS (via SERVER_URL), not NODE_ENV. A `Secure` cookie is silently
  // dropped by the browser on a plain-HTTP connection — tying this to
  // NODE_ENV=production would mean nobody could ever actually stay logged
  // in on a production deploy that hasn't gotten HTTPS yet (the current
  // state of the live deployment). This also self-corrects once a real
  // domain + TLS is in place, with no code change needed then.
  const isHttps = config.serverUrl.startsWith('https://');
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

// Register as a renter or host
router.post('/auth/signup', authRateLimiter, async (req: Request, res: Response) => {
  if (!req.body.fullName || !req.body.email || !req.body.phoneNumber || !req.body.password) {
    return res.status(400).json({ error: 'fullName, email, phoneNumber, and password are required' });
  }

  const fullName = normalizeFullName(req.body.fullName);
  const email = normalizeEmail(req.body.email);
  const phoneNumber = normalizePhone(req.body.phoneNumber);
  const password = String(req.body.password);
  const { role, referralCode } = req.body;

  if (fullName.length < 2 || fullName.length > 100) {
    return res.status(400).json({ error: 'Please enter a valid full name' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  if (!isValidPhone(phoneNumber)) {
    return res.status(400).json({ error: 'Please enter a valid phone number' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const requestedRole = role === Role.SELF_HOST || role === Role.FLEET_OPERATOR ? role : Role.CUSTOMER;

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phoneNumber }] } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email or phone number already exists' });
  }

  let referredById: string | undefined;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: String(referralCode).toUpperCase() } });
    if (referrer) referredById = referrer.id;
  }

  const passwordHash = await hashPassword(password);
  const newReferralCode = await generateUniqueReferralCode(fullName);
  const user = await prisma.user.create({
    data: { id: randomUUID(), fullName, email, phoneNumber, passwordHash, role: requestedRole, referralCode: newReferralCode, referredById },
    select: PUBLIC_USER_SELECT,
  });

  const token = signAuthToken({ userId: user.id, role: user.role });
  res.cookie(config.auth.cookieName, token, cookieOptions());
  issueCsrfCookie(res);
  // `token` is additive, alongside the unchanged `data` shape — cookie-based
  // clients (src/frontend/src/admin/src/agent) ignore it; cookie-less
  // clients (the Flutter app) store it and replay it as a bearer header.
  // See specs/001-flutter-renter-app/contracts/rest-api.md.
  res.status(201).json({ success: true, data: user, token });
});

router.post('/auth/login', authRateLimiter, async (req: Request, res: Response) => {
  if (!req.body.email || !req.body.password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password);

  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    // Still run the (dummy) compare so a locked account doesn't respond
    // faster than a normal failed attempt — that timing gap would itself
    // leak "this account is locked" to an attacker probing many emails.
    await comparePassword(password, DUMMY_PASSWORD_HASH);
    return res.status(423).json({ error: 'Too many failed attempts. Please try again in 15 minutes.' });
  }

  const passwordMatches = await comparePassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) {
    if (user) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });
    }
    // Deliberately the same message whether the email doesn't exist or the
    // password is wrong — distinguishing the two lets an attacker enumerate
    // registered emails.
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  if (user.isSuspended) {
    return res.status(403).json({ error: 'This account has been suspended. Contact eightlinesfleet@gmail.com.' });
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  const token = signAuthToken({ userId: user.id, role: user.role });
  res.cookie(config.auth.cookieName, token, cookieOptions());
  issueCsrfCookie(res);

  // Additive `token` field alongside the unchanged `data` shape — see the
  // comment on /auth/signup above.
  res.json({ success: true, data: toPublicUser(user), token });
});

// Request a login OTP for an existing account (guest or host — login is
// role-agnostic, same as password login). Always returns the same generic
// message regardless of whether the phone number has an account, so this
// endpoint can't be used to enumerate registered numbers.
router.post('/auth/otp/request', authRateLimiter, async (req: Request, res: Response) => {
  if (!req.body.phoneNumber) {
    return res.status(400).json({ error: 'phoneNumber is required' });
  }
  const phoneNumber = normalizePhone(req.body.phoneNumber);

  const genericResponse = { success: true, message: 'If that phone number has an account, a code has been sent.' };

  const user = await prisma.user.findUnique({ where: { phoneNumber }, select: { isSuspended: true } });
  if (!user || user.isSuspended) {
    return res.json(genericResponse);
  }

  try {
    const { devCode } = await requestOtp(phoneNumber);
    // devCode is only ever set outside production (see otpService) — no SMS
    // provider is wired up yet, so this is how OTP login can be tested today.
    res.json({ ...genericResponse, devCode });
  } catch (err: any) {
    res.status(429).json({ error: err.message });
  }
});

router.post('/auth/otp/verify', authRateLimiter, async (req: Request, res: Response) => {
  if (!req.body.phoneNumber || !req.body.code) {
    return res.status(400).json({ error: 'phoneNumber and code are required' });
  }
  const phoneNumber = normalizePhone(req.body.phoneNumber);

  const ok = await verifyOtp(phoneNumber, String(req.body.code));
  if (!ok) return res.status(401).json({ error: 'Invalid or expired code' });

  const user = await prisma.user.findUnique({ where: { phoneNumber } });
  if (!user) return res.status(401).json({ error: 'Invalid or expired code' });
  if (user.isSuspended) {
    return res.status(403).json({ error: 'This account has been suspended. Contact eightlinesfleet@gmail.com.' });
  }

  const token = signAuthToken({ userId: user.id, role: user.role });
  res.cookie(config.auth.cookieName, token, cookieOptions());
  issueCsrfCookie(res);

  // Additive `token` field alongside the unchanged `data` shape — see the
  // comment on /auth/signup above.
  res.json({ success: true, data: toPublicUser(user), token });
});

// Verifies a Supabase session (obtained client-side via
// supabase.auth.signInWithOAuth({ provider: 'google' })) and logs the
// matching existing account in. Deliberately login-only, not signup: our
// User model requires a unique phoneNumber, which Google's OAuth profile
// never provides, so a brand-new account still has to go through the normal
// signup form once. Existing accounts (whether they originally signed up
// with a password or via OTP) can use this from then on.
router.post('/auth/oauth/supabase', authRateLimiter, async (req: Request, res: Response) => {
  if (!config.supabase.url || !config.supabase.publishableKey) {
    return res.status(503).json({ error: 'Google sign-in is not configured yet' });
  }
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken is required' });
  }

  // Cryptographic JWT verification via @supabase/server/core, against the
  // JWKS at SUPABASE_JWKS_URL — no network round-trip to Supabase's /auth/v1/user
  // on every login like the old fetch()-based check this replaced. See
  // types/supabase-server-core.d.ts for why this needs an ambient type decl.
  let supabaseEmail: string;
  try {
    const { data: auth, error: verifyError } = await verifyCredentials({ token: accessToken, apikey: null }, { auth: 'user' });
    if (verifyError || !auth?.userClaims?.email) {
      return res.status(401).json({ error: 'Google sign-in session is invalid or expired' });
    }
    supabaseEmail = normalizeEmail(auth.userClaims.email);
  } catch (err) {
    console.error('[AUTH] Supabase token verification failed:', err);
    return res.status(502).json({ error: 'Could not verify Google sign-in right now. Please try again.' });
  }

  const user = await prisma.user.findUnique({ where: { email: supabaseEmail } });
  if (!user) {
    return res.status(404).json({ error: 'No Ziyam account found for that Google email yet. Please sign up first.', code: 'NO_ACCOUNT' });
  }
  if (user.isSuspended) {
    return res.status(403).json({ error: 'This account has been suspended. Contact eightlinesfleet@gmail.com.' });
  }

  const token = signAuthToken({ userId: user.id, role: user.role });
  res.cookie(config.auth.cookieName, token, cookieOptions());
  issueCsrfCookie(res);
  // Additive `token` field alongside the unchanged `data` shape — see the
  // comment on /auth/signup above.
  res.json({ success: true, data: toPublicUser(user), token });
});

// Apple Sign-In via real Firebase Auth (not routed through Supabase, unlike
// Google above) — the frontend does signInWithPopup(auth, new
// OAuthProvider('apple.com')) client-side, then hands the resulting ID
// token here for verification. Login-only, same as Google: Apple's email
// can be a private relay address the account was never created with, so
// there's no attempt to auto-create an account from it.
router.post('/auth/oauth/firebase', authRateLimiter, async (req: Request, res: Response) => {
  if (!isFirebaseConfigured()) {
    return res.status(503).json({ error: 'Apple sign-in is not configured yet' });
  }
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'idToken is required' });
  }

  let firebaseEmail: string;
  try {
    const decoded = await getAuthClient().verifyIdToken(idToken);
    if (!decoded.email) {
      return res.status(401).json({ error: 'Apple did not share an email for this sign-in' });
    }
    firebaseEmail = normalizeEmail(decoded.email);
  } catch (err) {
    console.error('[AUTH] Firebase token verification failed:', err);
    return res.status(401).json({ error: 'Apple sign-in session is invalid or expired' });
  }

  const user = await prisma.user.findUnique({ where: { email: firebaseEmail } });
  if (!user) {
    return res.status(404).json({ error: 'No Ziyam account found for that Apple email yet. Please sign up first.', code: 'NO_ACCOUNT' });
  }
  if (user.isSuspended) {
    return res.status(403).json({ error: 'This account has been suspended. Contact eightlinesfleet@gmail.com.' });
  }

  const token = signAuthToken({ userId: user.id, role: user.role });
  res.cookie(config.auth.cookieName, token, cookieOptions());
  issueCsrfCookie(res);
  // Additive `token` field alongside the unchanged `data` shape — see the
  // comment on /auth/signup above.
  res.json({ success: true, data: toPublicUser(user), token });
});

// Mints a Firebase custom token for the current Ziyam session, regardless
// of how the user actually logged in — lets the frontend silently sign
// into Firebase Auth so Firestore Security Rules can key off
// request.auth.uid for the real-time delivery-tracking/trip-chat listeners
// (see FirebaseAuthBridge.tsx). Not a login mechanism itself.
router.get('/auth/firebase-custom-token', requireAuth, async (req: Request, res: Response) => {
  if (!isFirebaseConfigured()) {
    return res.status(503).json({ error: 'Firebase is not configured' });
  }
  try {
    const token = await mintFirebaseCustomToken(req.user!.userId);
    res.json({ success: true, data: { token } });
  } catch (err) {
    console.error('[AUTH] Failed to mint Firebase custom token:', err);
    res.status(502).json({ error: 'Could not set up real-time features right now.' });
  }
});

router.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie(config.auth.cookieName, { path: '/' });
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  // Backfills the CSRF cookie for sessions that predate the CSRF gate — every
  // frontend calls this on app load before any mutation is possible, so this
  // is the one place a pre-existing session (cookie already set, but from
  // before this cookie existed) picks it up transparently, with no forced
  // re-login. Cheap to re-issue unconditionally on every call.
  issueCsrfCookie(res);

  let user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: PUBLIC_USER_SELECT,
  });
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Backfill referral codes for accounts created before Refer & Earn shipped.
  if (!user.referralCode) {
    const code = await generateUniqueReferralCode(user.fullName);
    user = await prisma.user.update({ where: { id: user.id }, data: { referralCode: code }, select: PUBLIC_USER_SELECT });
  }

  res.json({ success: true, data: user });
});

export default router;
