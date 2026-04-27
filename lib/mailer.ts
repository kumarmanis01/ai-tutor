/**
 * lib/mailer.ts
 * All transactional email. Renders React Email templates to HTML,
 * then dispatches via EMAIL_PROVIDER (resend | ses).
 *
 * Required env vars:
 *   EMAIL_PROVIDER   'resend' (default) | 'ses'
 *   RESEND_API_KEY   Required when EMAIL_PROVIDER=resend
 *   FROM_EMAIL       Sending address (default: no-reply@send.spinzyacademy.com)
 *   FROM_NAME        Display name    (default: Spinzy Academy)
 *   EMAIL_FROM       Full address override (overrides FROM_NAME + FROM_EMAIL)
 *
 *   For EMAIL_PROVIDER=ses:
 *   AWS_SES_SMTP_HOST / AWS_SES_SMTP_PORT / AWS_SES_SMTP_USER / AWS_SES_SMTP_PASS
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | initial B3.2 named send methods
 * - 2026-04-27T00:00:00Z | copilot | v3 -- React Email templates, EMAIL_PROVIDER abstraction
 * - 2026-04-27T18:38:00Z | copilot | align admin invite subject and template payload with A0.1/A0.2 acceptance criteria
 */

import * as React from 'react';
import { render } from '@react-email/render';
import { logger } from '@/lib/logger';
import { sendViaProvider } from '@/lib/email/email.provider';
import { OTPEmail } from '@/lib/email/templates/otp';
import { ConsentRequestEmail } from '@/lib/email/templates/consent-request';
import { WeeklyReportEmail, type WeeklyReportData } from '@/lib/email/templates/weekly-report';
import { AdminInviteEmail } from '@/lib/email/templates/admin-invite';
import { InvoiceEmail, type InvoiceEmailData } from '@/lib/email/templates/invoice';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

// ── Core send helpers ─────────────────────────────────────────────────────────

/**
 * Send email. Throws on failure.
 * Returns the provider message ID for logging/audit.
 * Use sendMailSafe() in workers where email failure must not crash the job.
 */
export async function sendMail(opts: MailOptions): Promise<string> {
  try {
    const id = await sendViaProvider(opts);
    logger.info('[mailer] Sent', { id, to: opts.to });
    return id;
  } catch (err) {
    logger.error('[mailer] Send failed', { error: err, to: opts.to, subject: opts.subject });
    throw err;
  }
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

// Alias kept for backwards compatibility.
export const sendEmail = sendMailSafe;

// ── Render helper ─────────────────────────────────────────────────────────────

async function renderHtml(element: React.ReactElement): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, text };
}

// ── Named transactional methods ───────────────────────────────────────────────

/**
 * Send a one-time password email.
 */
export async function sendOTP(to: string, otp: string, expiryMinutes = 10): Promise<void> {
  const { html, text } = await renderHtml(
    React.createElement(OTPEmail, { otp, expiryMinutes })
  );
  await sendMailSafe({
    to,
    subject: `${otp} is your Spinzy verification code`,
    html,
    text,
  });
}

/**
 * Send a parent consent request email with a link to approve/deny.
 */
export async function sendConsentRequest(
  to: string,
  parentName: string,
  childName: string,
  grade: string,
  consentLink: string,
  _opts?: { board?: string; denyLink?: string }
): Promise<void> {
  const { html, text } = await renderHtml(
    React.createElement(ConsentRequestEmail, { parentName, childName, grade, consentLink })
  );
  await sendMailSafe({
    to,
    subject: `${childName} wants to learn with Spinzy Academy -- Your Approval Needed`,
    html,
    text,
  });
}

/**
 * Send a weekly learning report to a parent.
 */
export async function sendWeeklyReport(
  to: string,
  data: {
    parentName: string;
    studentName: string;
    sessionsThisWeek: number;
    weeklyGoal: number;
    streakDays: number;
    topSubject: string;
    dashboardUrl?: string;
  }
): Promise<void> {
  const reportData: WeeklyReportData = {
    parentName: data.parentName,
    studentName: data.studentName,
    daysActive: Math.min(data.sessionsThisWeek, 7),
    totalSessions: data.sessionsThisWeek,
    topicsStudied: 0,
    currentStreak: data.streakDays,
    strongSubject: data.topSubject,
    dashboardUrl: data.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard',
  };
  const { html, text } = await renderHtml(React.createElement(WeeklyReportEmail, reportData));
  await sendMailSafe({
    to,
    subject: `${data.studentName}'s weekly learning summary`,
    html,
    text,
  });
}

/**
 * Send an admin invitation email with an account setup link.
 */
export async function sendAdminInvite(
  to: string,
  setupLink: string,
  role: string,
  adminName?: string
): Promise<void> {
  const { html, text } = await renderHtml(
    React.createElement(AdminInviteEmail, { setupLink, role, adminName })
  );
  await sendMailSafe({
    to,
    subject: `You've been invited to join Spinzy Academy Admin Panel`,
    html,
    text,
  });
}

/**
 * Send a payment invoice email.
 */
export async function sendPaymentInvoice(
  to: string,
  data: {
    studentName: string;
    invoiceNumber: string;
    plan: string;
    amountRupees: number;
    billingCycle: string;
    invoiceUrl: string;
  }
): Promise<void> {
  const invoiceData: InvoiceEmailData = {
    invoiceNumber: data.invoiceNumber,
    studentName: data.studentName,
    plan: data.plan,
    amountPaise: data.amountRupees * 100,
    billingDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    invoiceUrl: data.invoiceUrl,
  };
  const { html, text } = await renderHtml(React.createElement(InvoiceEmail, invoiceData));
  await sendMailSafe({
    to,
    subject: `Payment confirmed -- Invoice #${data.invoiceNumber}`,
    html,
    text,
  });
}
