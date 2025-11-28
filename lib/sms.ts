export type SendSmsResult =
  | { ok: true; provider: 'twilio' | 'dev'; id?: string }
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
export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  // Normalise phone as E.164 is recommended; here we assume caller
  // provides a valid phone string including country code (e.g. +91...).
  const to = String(phone).trim();

  // Development: just log and return ok
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SMS DEV] Sending to ${to}: ${message}`);
    return { ok: true, provider: 'dev' };
  }

  // Production: try Twilio
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || !from) {
    return { ok: false, error: 'Twilio credentials (TWILIO_SID/TWILIO_TOKEN/TWILIO_FROM) not set' };
  }

  try {
    // Dynamic import so the package is only loaded in production when present.
    // `twilio` is an optional runtime dependency; suppress TS module-not-found
    // errors here because the import is guarded by runtime env checks.
    // Use @ts-expect-error so linting rules prefer it over @ts-ignore
    // @ts-expect-error - optional dependency, safe to import at runtime
    const twilioMod = await import('twilio').catch((err) => {
      throw new Error(`twilio-import-failed: ${err?.message || err}`);
    });

    const Twilio = (twilioMod as any).default || twilioMod;
    const client = Twilio(sid, token);

    const msg = await client.messages.create({ body: message, from, to });

    if (msg && msg.sid) {
      return { ok: true, provider: 'twilio', id: msg.sid };
    }

    return { ok: false, error: 'Twilio did not return a message SID' };
  } catch (err: any) {
    // Log full error for debugging, but return a structured error
    console.error('[sendSms] Twilio send error', err);
    if (err && err.message) {
      return { ok: false, error: `twilio-error: ${err.message}` };
    }
    return { ok: false, error: 'twilio-error: unknown' };
  }
}
