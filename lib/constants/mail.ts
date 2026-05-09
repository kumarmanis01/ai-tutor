/**
 * lib/constants/mail.ts
 *
 * Canonical constants for all transactional email.
 * Single source of truth for FROM addresses, SUPPORT addresses, and email subjects.
 * Import from here rather than hard-coding strings at call sites.
 */

import {
  MAIL_CONSTANTS_NO_REPLY_EMAIL,
  MAIL_CONSTANTS_SUPPORT_EMAIL,
} from '@/lib/email/functionalityEmails';

// ── Addresses ─────────────────────────────────────────────────────────────────

export const MAIL_FROM =
  process.env.EMAIL_FROM ?? `Spinzy Academy <${MAIL_CONSTANTS_NO_REPLY_EMAIL}>`;

export const MAIL_SUPPORT = MAIL_CONSTANTS_SUPPORT_EMAIL;

export const MAIL_NOREPLY = MAIL_CONSTANTS_NO_REPLY_EMAIL;

// ── Email subjects ─────────────────────────────────────────────────────────────
// Use {name} placeholder where the recipient or student name should be inserted.

export const MAIL_SUBJECTS = {
  // Auth
  WELCOME: 'Welcome to Spinzy Academy!',
  MAGIC_LINK: 'Your Spinzy Academy sign-in link',

  // Parent verification
  PARENT_OTP: 'Parent verification code - Spinzy Academy',
  PARENT_WELCOME: 'Your child is set up on Spinzy Academy',

  // Learning events - parent notifications
  DIAGNOSTIC_COMPLETE: '{name} completed their diagnostic - Spinzy Academy',
  PLAN_GENERATED: "{name}'s personalised learning plan is ready - Spinzy Academy",
  SESSION_COMPLETE: '{name} completed a learning session today - Spinzy Academy',
  SESSION_MISSED: 'Give {name} a nudge - Spinzy Academy',

  // Payments
  PAYMENT_RECEIPT: 'Payment confirmed - Spinzy Academy',

  // Ongoing engagement
  WEEKLY_DIGEST: "{name}'s weekly learning report - Spinzy Academy",
  INACTIVITY_NUDGE: 'Give {name} a nudge - Spinzy Academy',
  TRIAL_ENDING: 'Your free sessions end soon - Spinzy Academy',
  MILESTONE: '{name} unlocked a milestone - Spinzy Academy',

  // Admin / system
  DISTRESS_ALERT: 'Student wellbeing alert - Spinzy Academy',
  COST_ANOMALY: 'Cost anomaly detected - Spinzy Academy',
  CONTENT_JOB_FAILURE: 'Content generation failure - Spinzy Academy',
  DIAGNOSTIC_READY: 'Diagnostic ready for {name} - Spinzy Academy',
  ACCOUNT_DELETION: 'Your Spinzy Academy account has been deleted',
} as const;

export type MailSubjectKey = keyof typeof MAIL_SUBJECTS;

/**
 * Interpolates {name} placeholder in an email subject string.
 */
export function formatSubject(template: string, name: string): string {
  return template.replace('{name}', name);
}

// ── Notification event names (canonical) ──────────────────────────────────────

export const PARENT_NOTIF_EVENTS = {
  AUTH: 'auth',
  DIAGNOSTIC_COMPLETE: 'diagnostic_complete',
  PLAN_GENERATED: 'plan_generated',
  SESSION_COMPLETE: 'session_complete',
  SESSION_MISSED: 'session_missed',
} as const;

export type ParentNotifEvent = (typeof PARENT_NOTIF_EVENTS)[keyof typeof PARENT_NOTIF_EVENTS];
