/**
 * FILE OBJECTIVE:
 * - Email provider abstraction. Selects between Resend (default) and AWS SES
 *   via nodemailer SMTP transport based on EMAIL_PROVIDER env var.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/email.provider.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created -- B3.2 email provider abstraction
 */

import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '@/lib/logger';
import type { MailOptions } from '@/lib/mailer';

// ── Provider type ─────────────────────────────────────────────────────────────

type EmailProvider = 'resend' | 'ses';

function getProvider(): EmailProvider {
  const p = (process.env.EMAIL_PROVIDER ?? 'resend').toLowerCase();
  if (p === 'ses') return 'ses';
  return 'resend';
}

// ── Resend provider ───────────────────────────────────────────────────────────

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('[mailer] RESEND_API_KEY not set');
    _resend = new Resend(key);
  }
  return _resend;
}

async function sendViaResend(opts: MailOptions, from: string): Promise<string> {
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

// ── SES provider (nodemailer SMTP) ────────────────────────────────────────────

let _sesTransport: Transporter | null = null;

function getSesTransport(): Transporter {
  if (!_sesTransport) {
    const host = process.env.AWS_SES_SMTP_HOST;
    const port = parseInt(process.env.AWS_SES_SMTP_PORT ?? '587', 10);
    const user = process.env.AWS_SES_SMTP_USER;
    const pass = process.env.AWS_SES_SMTP_PASS;
    if (!host || !user || !pass) {
      throw new Error('[mailer] AWS_SES_SMTP_HOST, AWS_SES_SMTP_USER, AWS_SES_SMTP_PASS required for EMAIL_PROVIDER=ses');
    }
    _sesTransport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  }
  return _sesTransport;
}

async function sendViaSes(opts: MailOptions, from: string): Promise<string> {
  const transport = getSesTransport();
  const info = await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.text && { text: opts.text }),
    ...(opts.replyTo && { replyTo: opts.replyTo }),
    ...(opts.cc && { cc: opts.cc }),
    ...(opts.attachments && {
      attachments: opts.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    }),
  });
  return (info.messageId as string) ?? '';
}

// ── Unified send ──────────────────────────────────────────────────────────────

/**
 * Send via whichever provider EMAIL_PROVIDER selects.
 * Returns message ID. Throws on failure.
 */
export async function sendViaProvider(opts: MailOptions): Promise<string> {
  const fromName = process.env.FROM_NAME ?? 'Spinzy Academy';
  const fromEmail = process.env.FROM_EMAIL ?? 'no-reply@send.spinzyacademy.com';
  const from = process.env.EMAIL_FROM ?? `${fromName} <${fromEmail}>`;

  const provider = getProvider();
  logger.info('[mailer] Sending email', { provider, to: opts.to, subject: opts.subject });

  if (provider === 'ses') {
    return sendViaSes(opts, from);
  }
  return sendViaResend(opts, from);
}
