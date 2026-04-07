/**
 * lib/mailer.ts
 * All transactional email via Resend
 *
 * Required env vars:
 *   RESEND_API_KEY   (from Resend dashboard -- re_xxxx)
 *   EMAIL_FROM       Spinzy Academy <no-reply@send.spinzyacademy.com>
 *
 * Verified sending domain: send.spinzyacademy.com (subdomain verified in Resend).
 * Free tier: 3,000 emails/month, 100/day.
 */
import { Resend } from 'resend';

// Lazy singleton -- avoids crash at module load time when RESEND_API_KEY is absent
// (e.g. during Next.js build or unit tests that do not exercise email).
let _client: Resend | null = null;
function getClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        '[mailer] RESEND_API_KEY not set. Add to .env.production and ecosystem.config.cjs',
      );
    }
    _client = new Resend(key);
  }
  return _client;
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer; // Buffer will be base64-encoded for the provider
    contentType?: string;
  }>;
}

/**
 * Send email via Resend. Throws on failure.
 * Returns the Resend message ID for logging/audit.
 * Use sendMailSafe() in workers where you don't want email failure
 * to crash the job.
 */
export async function sendMail(opts: MailOptions): Promise<string> {
  const from =
    process.env.EMAIL_FROM ?? 'Spinzy Academy <no-reply@send.spinzyacademy.com>';
  const { data, error } = await getClient().emails.send({
    from,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
    ...(opts.text && { text: opts.text }),
    ...(opts.replyTo && { reply_to: opts.replyTo }),
    ...(opts.cc && { cc: Array.isArray(opts.cc) ? opts.cc : [opts.cc] }),
    ...(opts.attachments && {
      attachments: opts.attachments.map((a) => ({
        filename: a.filename,
        // Resend expects base64 content for binary attachments in some SDK versions
        content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
        contentType: a.contentType,
      })),
    }),
  });
  if (error) {
    console.error('[mailer] Send failed:', {
      error: error.message,
      to: opts.to,
      subject: opts.subject,
    });
    throw new Error(`[mailer] ${error.message}`);
  }
  const id = data?.id ?? '';
  console.log('[mailer] Sent:', id, '->', opts.to);
  return id;
}

/**
 * Fire-and-forget wrapper. Never throws.
 * Safe for BullMQ workers, cron jobs, and webhooks.
 */
export async function sendMailSafe(opts: MailOptions): Promise<void> {
  try {
    await sendMail(opts);
  } catch (err) {
    console.error('[mailer] sendMailSafe suppressed error:', err);
  }
}

// Alias kept for backwards compatibility with existing call sites.
export const sendEmail = sendMailSafe;
