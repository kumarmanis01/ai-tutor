export type SendSmsResult =
  | { ok: true; provider: 'msg91' | 'dev'; id?: string }
  | { ok: false; error: string };

/**
 * Send an OTP SMS via MSG91 v5 OTP API.
 *
 * Behavior:
 * - In non-production: logs to console only, returns dev-ok (no SMS sent).
 * - In production: uses MSG91 OTP API v5.
 *   Requires env vars: MSG91_AUTH_KEY, MSG91_TEMPLATE_ID
 *   Optional: MSG91_SENDER (default 'MSGIND')
 *
 * Returns a structured result -- never throws for expected error cases.
 */
import { logger } from '@/lib/logger';

export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  const to = String(phone).replace(/\D/g, '');

  // Development: log only, no real SMS
  if (process.env.NODE_ENV !== 'production') {
    logger.add(`[SMS DEV] To +91${to}: ${message}`, { className: 'sms', methodName: 'sendSms' });
    return { ok: true, provider: 'dev' };
  }

  // Production: validate required env vars before attempting the API call
  if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_TEMPLATE_ID) {
    logger.add('[sendSms] MSG91_AUTH_KEY or MSG91_TEMPLATE_ID not configured', {
      className: 'sms',
      methodName: 'sendSms',
    });
    return { ok: false, error: 'MSG91 not configured' };
  }

  // Extract the 6-digit OTP from the message so we can pass it directly to MSG91
  // MSG91 OTP API v5 injects the otp variable into the approved template
  const otpMatch = message.match(/\b(\d{4,6})\b/);
  const otp = otpMatch ? otpMatch[1] : undefined;

  try {
    const url = 'https://control.msg91.com/api/v5/otp';
    const payload: Record<string, string> = {
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: `91${to}`, // always prefix with country code
      authkey: process.env.MSG91_AUTH_KEY,
    };
    if (otp) {
      payload['otp'] = otp;
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        authkey: process.env.MSG91_AUTH_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;

    if (!resp.ok) {
      logger.add(`[sendSms] MSG91 v5 failed status=${resp.status} body=${JSON.stringify(json)}`, {
        className: 'sms',
        methodName: 'sendSms',
      });
      return { ok: false, error: `msg91-error: ${resp.status}` };
    }

    // MSG91 v5 returns { type: 'success', message: '...' }
    if (json['type'] === 'error') {
      logger.add(`[sendSms] MSG91 v5 returned error: ${JSON.stringify(json)}`, {
        className: 'sms',
        methodName: 'sendSms',
      });
      return { ok: false, error: `msg91-error: ${String(json['message'] ?? 'unknown')}` };
    }

    return { ok: true, provider: 'msg91', id: String(json['message'] ?? '') || undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.add(`[sendSms] MSG91 v5 exception: ${msg}`, { className: 'sms', methodName: 'sendSms' });
    return { ok: false, error: `msg91-error: ${msg}` };
  }
}
