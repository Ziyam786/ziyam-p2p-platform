import axios from 'axios';
import { config } from '../config';

/**
 * MSG91 transactional SMS (https://docs.msg91.com/reference/send-sms). Real
 * transactional SMS in India requires a DLT-registered template per distinct
 * message — every call site supplies its own templateId (e.g. an OTP
 * template vs. a booking-confirmed template are two different registrations,
 * not the same one reused), plus whatever variables that template expects.
 * Never throws — a failed/unconfigured send must never block whatever
 * triggered it, same "stub the unavailable external service" pattern as
 * every other provider in this app.
 */

export function isSmsConfigured(): boolean {
  return Boolean(config.sms.authKey);
}

export async function sendTemplateSms(phoneNumber: string, templateId: string, variables: Record<string, string>): Promise<void> {
  if (!isSmsConfigured() || !templateId) {
    console.log(`[SMS] (not configured — logged only) To ${phoneNumber}, template ${templateId}:`, variables);
    return;
  }

  try {
    await axios.post(
      'https://control.msg91.com/api/v5/flow/',
      {
        template_id: templateId,
        sender: config.sms.senderId,
        recipients: [{ mobiles: phoneNumber.replace(/^\+?91/, '91'), ...variables }],
      },
      { headers: { authkey: config.sms.authKey, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error(`[SMS] MSG91 send failed for ${phoneNumber}:`, err.response?.data ?? err.message);
  }
}
