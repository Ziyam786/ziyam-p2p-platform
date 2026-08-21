import axios from 'axios';
import { config } from '../config';

/**
 * Sandbox (sandbox.co.in) — Aadhaar eKYC (OTP-based) and bank account penny-drop
 * verification. Access tokens are valid 24h; we cache in-memory and refresh
 * lazily rather than re-authenticating on every call.
 * Docs: https://developer.sandbox.co.in
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

function client() {
  return axios.create({ baseURL: config.sandbox.baseUrl, headers: { 'Content-Type': 'application/json' } });
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const res = await client().post(
    '/authenticate',
    {},
    {
      headers: {
        'x-api-key': config.sandbox.apiKey,
        'x-api-secret': config.sandbox.apiSecret,
        'x-api-version': '1.0.0',
      },
    }
  );

  const token = res.data?.access_token;
  if (!token) throw new Error('Sandbox authenticate response missing access_token');
  // Tokens are valid 24h; refresh a little early to be safe.
  cachedToken = { token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
  return token;
}

async function authedHeaders() {
  return { Authorization: await getAccessToken(), 'x-api-key': config.sandbox.apiKey };
}

function assertConfigured() {
  if (!config.sandbox.apiKey || !config.sandbox.apiSecret) {
    throw new Error('Sandbox API key/secret are not configured (SANDBOX_API_KEY / SANDBOX_API_SECRET)');
  }
}

export interface AadhaarOtpGenerateResult {
  referenceId: string | number;
  message: string;
}

export interface AadhaarOtpVerifyResult {
  name: string;
  dateOfBirth?: string;
  gender?: string;
  fullAddress?: string;
  photo?: string;
}

export interface BankVerifyResult {
  accountExists: boolean;
  nameAtBank: string | null;
  utr: string | null;
  amountDeposited: string | null;
  message: string;
}

export const sandboxService = {
  async generateAadhaarOtp(aadhaarNumber: string, reason: string): Promise<AadhaarOtpGenerateResult> {
    assertConfigured();
    const headers = await authedHeaders();
    const res = await client().post(
      '/kyc/aadhaar/okyc/otp',
      {
        '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
        aadhaar_number: aadhaarNumber,
        consent: 'Y',
        reason,
      },
      { headers }
    );
    const { reference_id, message } = res.data.data;
    // Sandbox returns HTTP 200 even when no OTP was actually sent — e.g. an
    // invalid Aadhaar number comes back as `{ reference_id, message:
    // "Invalid Aadhaar Card" }`, identical in shape to a real send. Per
    // Sandbox's own docs, the only way to tell them apart is this exact
    // string — there is no separate status/boolean field.
    if (message !== 'OTP sent successfully') {
      const err = new Error(message) as Error & { sandboxBusinessFailure?: true };
      err.sandboxBusinessFailure = true;
      throw err;
    }
    return { referenceId: reference_id, message };
  },

  async verifyAadhaarOtp(referenceId: string | number, otp: string): Promise<AadhaarOtpVerifyResult> {
    assertConfigured();
    const headers = await authedHeaders();
    const res = await client().post(
      '/kyc/aadhaar/okyc/otp/verify',
      { '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request', reference_id: referenceId, otp },
      { headers }
    );
    const d = res.data.data;
    return { name: d.name, dateOfBirth: d.date_of_birth, gender: d.gender, fullAddress: d.full_address, photo: d.photo };
  },

  async verifyBankAccount(ifsc: string, accountNumber: string, name?: string): Promise<BankVerifyResult> {
    assertConfigured();
    const headers = await authedHeaders();
    const res = await client().get(`/bank/${encodeURIComponent(ifsc)}/accounts/${encodeURIComponent(accountNumber)}/verify`, {
      headers,
      params: name ? { name } : undefined,
    });
    const d = res.data.data;
    return {
      accountExists: Boolean(d.account_exists),
      nameAtBank: d.name_at_bank ?? null,
      utr: d.utr ?? null,
      amountDeposited: d.amount_deposited ?? null,
      message: d.message,
    };
  },

  isConfigured(): boolean {
    return Boolean(config.sandbox.apiKey && config.sandbox.apiSecret);
  },
};
