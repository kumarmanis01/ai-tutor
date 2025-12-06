export type SendSmsResult =
  | { ok: true; provider: 'msg91' | 'dev'; id?: string }
  | { ok: false; error: string };

/**
 * Send an SMS message.
 *
 * Behavior:
 * - In non-production, we log to console and return a dev-ok result.
 * - In production, we attempt to use Twilio when `TWILIO_SID`,
 *   `TWILIO_TOKEN` and `TWILIO_FROM` are present.
 * - The function returns a structured result instead of throwing when
 *   possible, but will re-throw internal unexpected errors.
 */
import { logger } from '@/lib/logger';

export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  // Normalise phone as E.164 is recommended; here we assume caller
  // provides a valid phone string including country code (e.g. +91...).
  const to = String(phone).trim();

  // Development: just log and return ok
  if (process.env.NODE_ENV !== 'production') {
    logger.add(`[SMS DEV] Sending to ${to}: ${message}`, { className: 'sms', methodName: 'sendSms' });
    return { ok: true, provider: 'dev' };
  }

  // Production: try MSG91 when configured
  const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
  if (!MSG91_AUTH_KEY) {
    return { ok: false, error: 'MSG91_AUTH_KEY not set in environment' };
  }

  try {
    // Use MSG91 send SMS endpoint. MSG91 has multiple APIs; here we call the control v2 sendsms endpoint
    // with form-encoded params. Adjust if your MSG91 account requires a different endpoint or parameters.
    const sender = process.env.MSG91_SENDER ?? 'MSGIND';
    const country = process.env.MSG91_COUNTRY ?? '91';

    const url = 'https://control.msg91.com/api/v2/sendsms';
    const params = new URLSearchParams();
    params.append('authkey', MSG91_AUTH_KEY);
    params.append('mobiles', to);
    params.append('message', message);
    params.append('sender', sender);
    params.append('route', process.env.MSG91_ROUTE ?? '4');
    params.append('country', country);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const json = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      logger.add(`[sendSms] MSG91 send failed status=${resp.status} body=${JSON.stringify(json)}`, { className: 'sms', methodName: 'sendSms' });
      return { ok: false, error: `msg91-error: ${resp.status}` };
    }

    // MSG91 v2 usually returns { type: 'success', message: '...' } or an object with details.
    return { ok: true, provider: 'msg91', id: (json as any)?.messageId || (json as any)?.message || undefined };
  } catch (err: any) {
    logger.add(`[sendSms] MSG91 send error ${String(err)}`, { className: 'sms', methodName: 'sendSms' });
    return { ok: false, error: `msg91-error: ${err?.message || 'unknown'}` };
  }
}
