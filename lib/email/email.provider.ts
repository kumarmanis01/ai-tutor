/**
 * FILE OBJECTIVE:
 * - Email provider abstraction. Sends via Resend (EMAIL_PROVIDER=resend, the default).
 *   SES/SMTP support has been removed -- use Resend for all transactional email.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/email.provider.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created -- B3.2 email provider abstraction
 * - 2026-04-27T00:00:00Z | copilot | remove SES/nodemailer, redact PII from logs
 */

import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import type { MailOptions } from '@/lib/mailer';

// ── Resend singleton ──────────────────────────────────────────────────────────

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('[mailer] RESEND_API_KEY not set');
    _resend = new Resend(key);
  }
  return _resend;
}

// ── Unified send ──────────────────────────────────────────────────────────────

/**
 * Send via Resend. Returns message ID. Throws on failure.
 */
export async function sendViaProvider(opts: MailOptions): Promise<string> {
  const fromName = process.env.FROM_NAME ?? 'Spinzy Academy';
  const fromEmail = process.env.FROM_EMAIL ?? 'no-reply@send.spinzyacademy.com';
  const from = process.env.EMAIL_FROM ?? `${fromName} <${fromEmail}>`;

  logger.info('[mailer] Sending email', { provider: 'resend', recipients: Array.isArray(opts.to) ? opts.to.length : 1 });

  const { data, error } = await getResend().emails.send({
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
        content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
        contentType: a.contentType,
      })),
    }),
  });

  if (error) throw new Error(`[resend] ${error.message}`);
  return data?.id ?? '';
}
