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
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | add B3.2 named send methods: sendOTP, sendConsentRequest, sendWeeklyReport, sendAdminInvite, sendPaymentInvoice
 */
import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import {
  otpEmailHtml,
  consentRequestEmailHtml,
  weeklyReportEmailHtml,
  adminInviteEmailHtml,
  paymentInvoiceEmailHtml,
} from '@/lib/email/templates';

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
    logger.error('[mailer] Send failed', { error: error.message, to: opts.to, subject: opts.subject });
    throw new Error(`[mailer] ${error.message}`);
  }
  const id = data?.id ?? '';
  logger.info('[mailer] Sent', { id, to: opts.to });
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
    logger.error('[mailer] sendMailSafe suppressed error', { error: err });
  }
}

// Alias kept for backwards compatibility with existing call sites.
export const sendEmail = sendMailSafe;

// ─────────────────────────────────────────────────────────────────────────────
// B3.2 -- Named transactional email methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a one-time password email.
 */
export async function sendOTP(
  to: string,
  otp: string,
  expiryMinutes = 10,
): Promise<void> {
  await sendMailSafe({
    to,
    subject: `${otp} is your Spinzy verification code`,
    html: otpEmailHtml(otp, expiryMinutes),
  });
}

/**
 * Send a parent consent request email with a link to approve/deny.
 * P1.2-R: updated subject and opts for board + deny link.
 */
export async function sendConsentRequest(
  to: string,
  parentName: string,
  childName: string,
  grade: string,
  consentLink: string,
  opts?: { board?: string; denyLink?: string },
): Promise<void> {
  await sendMailSafe({
    to,
    subject: `${childName} wants to learn with Spinzy Academy -- Your Approval Needed`,
    html: consentRequestEmailHtml(parentName, childName, grade, consentLink, opts),
  });
}

/**
 * Send a weekly learning report to a parent.
 */
export async function sendWeeklyReport(
  to: string,
  data: {
    parentName: string
    studentName: string
    sessionsThisWeek: number
    weeklyGoal: number
    streakDays: number
    topSubject: string
    dashboardUrl?: string
  },
): Promise<void> {
  await sendMailSafe({
    to,
    subject: `${data.studentName}'s weekly learning summary`,
    html: weeklyReportEmailHtml(data),
  });
}

/**
 * Send an admin invitation email with an account setup link.
 */
export async function sendAdminInvite(
  to: string,
  setupLink: string,
  role: string,
): Promise<void> {
  await sendMailSafe({
    to,
    subject: 'You have been invited to Spinzy Admin',
    html: adminInviteEmailHtml(setupLink, role),
  });
}

/**
 * Send a payment invoice email.
 */
export async function sendPaymentInvoice(
  to: string,
  data: {
    studentName: string
    invoiceNumber: string
    plan: string
    amountRupees: number
    billingCycle: string
    invoiceUrl: string
  },
): Promise<void> {
  await sendMailSafe({
    to,
    subject: `Payment confirmed -- Invoice #${data.invoiceNumber}`,
    html: paymentInvoiceEmailHtml(data),
  });
}
