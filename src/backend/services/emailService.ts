import axios from 'axios';
import { config } from '../config';

/**
 * Resend transactional email (https://resend.com/docs/api-reference/emails/send-email)
 * — called via axios, no SDK dependency, same as every other provider
 * integration in this codebase. Never throws — see smsService.ts's doc
 * comment for why.
 */

export function isEmailConfigured(): boolean {
  return Boolean(config.email.apiKey);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[EMAIL] (not configured — logged only) To ${to}, subject "${subject}"`);
    return;
  }

  try {
    await axios.post(
      'https://api.resend.com/emails',
      { from: config.email.fromAddress, to, subject, html },
      { headers: { Authorization: `Bearer ${config.email.apiKey}`, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[EMAIL] Resend send failed for %s:', to, err.response?.data ?? err.message);
  }
}
