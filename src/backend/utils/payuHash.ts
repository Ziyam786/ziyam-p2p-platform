import crypto from 'crypto';
import { config } from '../config';

export interface PayuHashFields {
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

function sha512(input: string): string {
  return crypto.createHash('sha512').update(input).digest('hex');
}

/**
 * Forward hash for initiating a PayU Hosted Checkout payment.
 * Formula (fixed 5 UDF slots, always present even if blank):
 *   sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 */
export function generatePayuHash(fields: PayuHashFields): string {
  const { txnid, amount, productinfo, firstname, email, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '' } = fields;
  const raw = [
    config.payu.key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    '',
    '',
    '',
    '',
    '',
    '',
    config.payu.salt,
  ].join('|');
  return sha512(raw);
}

/**
 * Reverse hash to verify PayU's success/failure postback. If a split payment
 * was requested, PayU echoes back a `splitInfo` field that must be spliced
 * into the hash between `status` and the UDF block.
 * Formula:
 *   sha512(SALT|status[|splitInfo]||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 */
export function verifyPayuResponseHash(params: {
  status: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  splitInfo?: string;
  hash: string;
}): boolean {
  const { status, txnid, amount, productinfo, firstname, email, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '', splitInfo, hash } = params;

  const middle = splitInfo ? `${status}|${splitInfo}` : status;
  const raw = [
    config.payu.salt,
    middle,
    '',
    '',
    '',
    '',
    '',
    udf5,
    udf4,
    udf3,
    udf2,
    udf1,
    email,
    firstname,
    productinfo,
    amount,
    txnid,
    config.payu.key,
  ].join('|');

  const expected = sha512(raw);
  // Constant-time comparison to avoid timing side-channels on the hash check.
  const a = Buffer.from(expected);
  const b = Buffer.from(hash.toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Hash for PayU's server-to-server "command" APIs (e.g. postservice.php),
 * used for Split After Transaction, refunds, verify-payment, etc.
 * Formula: sha512(key|command|var1|SALT)
 */
export function generatePayuCommandHash(command: string, var1: string): string {
  return sha512(`${config.payu.key}|${command}|${var1}|${config.payu.salt}`);
}
