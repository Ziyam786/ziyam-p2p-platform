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
  nodeEnv: process.env.NODE_ENV ?? 'development',

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

  telematics: {
    gatewayUrl: process.env.TELEMATICS_GATEWAY_URL ?? 'https://api.telematics-provider.com/v1',
    apiKey: process.env.TELEMATICS_API_KEY ?? '',
  },

  kyc: {
    provider: process.env.KYC_PROVIDER ?? 'digilocker',
    apiKey: process.env.KYC_API_KEY ?? '',
  },
};

export { requireEnv };
