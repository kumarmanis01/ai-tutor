/**
 * lib/mailer.ts
 * All transactional email via Resend (https://resend.com)
 *
 * Required env vars:
 *   RESEND_API_KEY=re_xxxx   (from Resend dashboard)
 *   EMAIL_FROM=Spinzy Academy <no-reply@spinzyacademy.com>
 *
 * Domain spinzyacademy.com must be verified in Resend dashboard.
 * Free tier: 3,000 emails/month, 100/day.
 */
import { Resend } from 'resend';

// Lazy singleton — avoids throwing at module load time when RESEND_API_KEY
// is absent (e.g. in test environments or during Next.js build).
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendMail(opts: MailOptions): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'Spinzy Academy <no-reply@spinzyacademy.com>';
  const { error } = await getResend().emails.send({
    from,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
  });
  if (error) {
    console.error('[mailer] Resend error:', {
      code: error.name,
      message: error.message,
      to: opts.to,
      subject: opts.subject,
    });
    throw new Error(`Email send failed: ${error.message}`);
  }
}

// Convenience: fire-and-forget for non-critical emails.
// Logs error but never throws — safe to use in workers.
export async function sendMailSafe(opts: MailOptions): Promise<void> {
  try {
    await sendMail(opts);
  } catch (err) {
    console.error('[mailer] sendMailSafe suppressed error:', err);
  }
}

// Alias kept for backwards compatibility with existing call sites.
export const sendEmail = sendMail;
