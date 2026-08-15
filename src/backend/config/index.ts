import dotenv from 'dotenv';
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
  adminUrl: process.env.ADMIN_URL ?? 'http://localhost:3002',
  serverUrl: process.env.SERVER_URL ?? `http://localhost:${Number(process.env.PORT ?? 5000)}`,
  nodeEnv: process.env.NODE_ENV ?? 'development',

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

  ai: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001',
  },
};

export { requireEnv };
