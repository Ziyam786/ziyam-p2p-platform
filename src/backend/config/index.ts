import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 5000),
  clientUrl: process.env.CLIENT_URL ?? '*',
  adminUrl: process.env.ADMIN_URL ?? 'http://localhost:3001',
  // Standalone ground-staff app (src/agent) — ops trip check-in/checkout, cash
  // counter, ID verification. Separate origin from adminUrl since it's a
  // wholly separate Next.js app/deployment, not a page inside the admin panel.
  agentUrl: process.env.AGENT_URL ?? 'http://localhost:3002',
  serverUrl: process.env.SERVER_URL ?? `http://localhost:${Number(process.env.PORT ?? 5000)}`,
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // Where host-uploaded photos/documents (car images, RC/insurance/PUC, KYC
  // selfies, signatures) are written on disk — mounted as a Docker volume in
  // production so files survive image rebuilds. Served back out at /uploads.
  uploadDir: process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads'),

  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'dev_insecure_secret_change_me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
    cookieName: 'ziyam_session',
  },

  payout: {
    platformCommission: Number(process.env.PLATFORM_COMMISSION_PERCENTAGE ?? 0.3),
    hostShare: Number(process.env.HOST_PAYOUT_PERCENTAGE ?? 0.7),
    settlementHours: Number(process.env.PAYOUT_SETTLEMENT_HOURS ?? 24),
  },

  payments: {
    provider: process.env.PAYMENT_PROVIDER ?? 'razorpay',
    apiKey: process.env.PAYMENT_API_KEY ?? '',
    apiSecret: process.env.PAYMENT_API_SECRET ?? '',
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET ?? '',
  },

  payu: {
    mode: process.env.PAYU_MODE ?? 'test', // 'test' | 'live'
    key: process.env.PAYU_KEY ?? '',
    salt: process.env.PAYU_SALT ?? '',
    clientId: process.env.PAYU_CLIENT_ID ?? '',
    clientSecret: process.env.PAYU_CLIENT_SECRET ?? '',
    get checkoutUrl() {
      return this.mode === 'live' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
    },
  },

  telematics: {
    gatewayUrl: process.env.TELEMATICS_GATEWAY_URL ?? 'https://api.telematics-provider.com/v1',
    apiKey: process.env.TELEMATICS_API_KEY ?? '',
  },

  kyc: {
    provider: process.env.KYC_PROVIDER ?? 'digilocker',
    apiKey: process.env.KYC_API_KEY ?? '',
  },

  // Sandbox (sandbox.co.in) — Aadhaar eKYC + bank account penny-drop verification.
  sandbox: {
    mode: process.env.SANDBOX_MODE ?? 'test', // 'test' | 'live'
    apiKey: process.env.SANDBOX_API_KEY ?? '',
    apiSecret: process.env.SANDBOX_API_SECRET ?? '',
    get baseUrl() {
      return this.mode === 'live' ? 'https://api.sandbox.co.in' : 'https://test-api.sandbox.co.in';
    },
  },

  // Setu (bridge.setu.co) — DigiLocker KYC (OAuth-style consent redirect) + Aadhaar eSign.
  // Both products share the same "data" gateway base URL.
  setu: {
    mode: process.env.SETU_MODE ?? 'test', // 'test' | 'live'
    clientId: process.env.SETU_CLIENT_ID ?? '',
    clientSecret: process.env.SETU_CLIENT_SECRET ?? '',
    digilockerProductInstanceId: process.env.SETU_DIGILOCKER_PRODUCT_INSTANCE_ID ?? '',
    esignProductInstanceId: process.env.SETU_ESIGN_PRODUCT_INSTANCE_ID ?? '',
    get baseUrl() {
      return this.mode === 'live' ? 'https://dg.setu.co' : 'https://dg-sandbox.setu.co';
    },
  },

  ai: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001',
  },

  // MSG91 — SMS + WhatsApp, one vendor for both (see smsService.ts / whatsappService.ts).
  // Real transactional SMS in India requires a separate DLT-registered
  // template per distinct message (OTP vs. booking-confirmed are two
  // different registrations) — each templateId env var is that template's
  // MSG91 ID, not free-form text.
  sms: {
    authKey: process.env.MSG91_AUTH_KEY ?? '',
    senderId: process.env.MSG91_SENDER_ID ?? 'ZIYAM',
    otpTemplateId: process.env.MSG91_OTP_TEMPLATE_ID ?? '',
    bookingConfirmedTemplateId: process.env.MSG91_BOOKING_CONFIRMED_TEMPLATE_ID ?? '',
  },
  whatsapp: {
    authKey: process.env.MSG91_AUTH_KEY ?? '',
    integratedNumber: process.env.MSG91_WHATSAPP_NUMBER ?? '',
  },

  // Resend — transactional email (see emailService.ts). Called via axios, no SDK
  // dependency, same as every other provider integration in this file.
  email: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    fromAddress: process.env.EMAIL_FROM ?? 'Ziyam <noreply@ziyam.in>',
  },

  // Supabase is used only for "Continue with Google" — the OAuth dance
  // happens entirely client-side via @supabase/supabase-js, and this backend
  // just verifies the resulting access token against Supabase's own /auth/v1/user
  // endpoint. Everything else (sessions, all other routes) still runs on the
  // existing JWT-cookie system untouched.
  // Firebase Admin — push notifications only (see firebaseAdmin.ts /
  // pushNotificationService.ts). The full service account JSON, as a single
  // env var string (paste the whole downloaded JSON file's contents).
  firebase: {
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '',
  },

  // Only used for the config.supabase.url/publishableKey guard in
  // auth.routes.ts's /auth/oauth/supabase — actual verification goes through
  // @supabase/server/core's verifyCredentials, which reads SUPABASE_URL/
  // SUPABASE_PUBLISHABLE_KEY/SUPABASE_JWKS_URL from process.env directly
  // (its own env resolution, independent of this config object).
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
  },
};

export { requireEnv };
