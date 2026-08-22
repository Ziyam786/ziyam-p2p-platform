import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

/**
 * RazorpayX Payouts — a separate product/API from Razorpay Payments, used
 * to pay a host directly from Ziyam's own RazorpayX balance (not a split of
 * a captured payment, unlike executeBankTransfer in payoutEngine.ts). The
 * installed `razorpay` SDK (2.9.8) has no `contacts`/`payouts` resources, so
 * this makes raw HTTP calls instead, matching the same Basic Auth scheme
 * documented at https://razorpay.com/docs/api/x/payouts/create/bank-account/.
 */
function client() {
  return axios.create({
    baseURL: 'https://api.razorpay.com/v1',
    auth: { username: config.razorpayx.keyId, password: config.razorpayx.keySecret },
    headers: { 'Content-Type': 'application/json' },
  });
}

function assertConfigured() {
  if (!config.razorpayx.keyId || !config.razorpayx.keySecret || !config.razorpayx.accountNumber) {
    throw new Error('RazorpayX is not configured (RAZORPAYX_KEY_ID / RAZORPAYX_KEY_SECRET / RAZORPAYX_ACCOUNT_NUMBER)');
  }
}

export const razorpayxPayoutService = {
  /**
   * Idempotent per Razorpay's own docs (matching contact/fund-account
   * details return the existing record instead of creating a duplicate), so
   * this never needs to check for an existing one before calling — except
   * the cheap User.razorpayxFundAccountId cache, which skips both calls
   * entirely on every payout after the first for a given host.
   */
  async getOrCreateFundAccount(host: {
    id: string;
    fullName: string;
    email: string;
    bankAccountNumber: string | null;
    bankIfsc: string | null;
    bankNameAtBank: string | null;
    razorpayxFundAccountId: string | null;
  }): Promise<string> {
    if (host.razorpayxFundAccountId) return host.razorpayxFundAccountId;
    assertConfigured();
    if (!host.bankAccountNumber || !host.bankIfsc) {
      throw new Error('Host has no verified bank account on file');
    }

    const contactRes = await client().post('/contacts', {
      name: host.fullName,
      email: host.email,
      type: 'vendor',
      reference_id: host.id,
    });
    const contactId = contactRes.data.id;

    const fundAccountRes = await client().post('/fund_accounts', {
      contact_id: contactId,
      account_type: 'bank_account',
      bank_account: {
        name: host.bankNameAtBank || host.fullName,
        ifsc: host.bankIfsc,
        account_number: host.bankAccountNumber,
      },
    });
    const fundAccountId = fundAccountRes.data.id;

    await prisma.user.update({ where: { id: host.id }, data: { razorpayxFundAccountId: fundAccountId } });
    return fundAccountId;
  },

  async createPayout(fundAccountId: string, amountRupees: number, ledgerId: string): Promise<{ id: string; status: string }> {
    assertConfigured();
    const res = await client().post(
      '/payouts',
      {
        account_number: config.razorpayx.accountNumber,
        fund_account_id: fundAccountId,
        amount: Math.round(amountRupees * 100),
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: ledgerId,
      },
      { headers: { 'X-Payout-Idempotency': ledgerId } }
    );
    return { id: res.data.id, status: res.data.status };
  },
};
