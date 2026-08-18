import axios from 'axios';
import { config } from '../config';

/**
 * MSG91 WhatsApp Business API (https://docs.msg91.com/reference/send-whatsapp-message)
 * — same MSG91 account as smsService.ts, different product. Sends a
 * template-based message (WhatsApp Business also requires pre-approved
 * templates, same DLT-adjacent constraint as SMS). Never throws — see
 * smsService.ts's doc comment for why.
 */

export function isWhatsappConfigured(): boolean {
  return Boolean(config.whatsapp.authKey && config.whatsapp.integratedNumber);
}

export async function sendTemplateWhatsapp(phoneNumber: string, templateName: string, variables: Record<string, string>): Promise<void> {
  if (!isWhatsappConfigured()) {
    console.log('[WHATSAPP] (not configured — logged only) To %s, template %s:', phoneNumber, templateName, variables);
    return;
  }

  try {
    await axios.post(
      'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/',
      {
        integrated_number: config.whatsapp.integratedNumber,
        content_type: 'template',
        payload: {
          to: phoneNumber.replace(/^\+?91/, '91'),
          type: 'template',
          template: { name: templateName, language: { code: 'en', policy: 'deterministic' }, to_and_components: [{ body_1: variables }] },
        },
      },
      { headers: { authkey: config.whatsapp.authKey, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[WHATSAPP] MSG91 send failed for %s:', phoneNumber, err.response?.data ?? err.message);
  }
}
