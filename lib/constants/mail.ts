/**
 * FILE OBJECTIVE:
 * - Canonical constants for all transactional email and notification events.
 *   Single source of truth for FROM addresses, email subjects, notification event
 *   names, and centralized from-address constants.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/constants/mail.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | staff-engineer | add EMAIL_FROM, all MAIL_SUBJECTS for 30+ notification templates, NOTIFICATION_EVENT_TYPES
 * - 2026-05-13T00:00:00Z | copilot | update subject lines to use "Spinzy Academy" branding
 */

import {
  MAIL_CONSTANTS_NO_REPLY_EMAIL,
  MAIL_CONSTANTS_SUPPORT_EMAIL,
} from '@/lib/email/functionalityEmails';

// ── From addresses ─────────────────────────────────────────────────────────────

export const MAIL_FROM =
  process.env.EMAIL_FROM ?? `Spinzy Academy <${MAIL_CONSTANTS_NO_REPLY_EMAIL}>`;

export const MAIL_SUPPORT = MAIL_CONSTANTS_SUPPORT_EMAIL;

export const MAIL_NOREPLY = MAIL_CONSTANTS_NO_REPLY_EMAIL;

/**
 * Canonical FROM address constants for each sender persona.
 * Use a specific persona rather than defaulting to NOREPLY everywhere.
 */
export const EMAIL_FROM = {
  NOREPLY:  `Spinzy Academy <${MAIL_CONSTANTS_NO_REPLY_EMAIL}>`,
  SUPPORT:  `Spinzy Academy <${MAIL_CONSTANTS_SUPPORT_EMAIL}>`,
  LEARNING: `Vidya at Spinzy <learning@spinzyacademy.com>`,
  BILLING:  `Spinzy Academy <billing@spinzyacademy.com>`,
} as const;

// ── Email subjects ─────────────────────────────────────────────────────────────
// Use {name} placeholder where the recipient or student name should be inserted.
// Use {date}, {concept}, {subject}, {streakDays} etc. for other interpolations.

export const MAIL_SUBJECTS = {
  // Auth
  WELCOME:                   'Welcome to Spinzy Academy!',
  MAGIC_LINK:                'Your Spinzy Academy sign-in link',

  // Parent verification
  PARENT_OTP:                'Parent verification code - Spinzy Academy',
  PARENT_WELCOME:            'Your child is set up on Spinzy Academy',

  // Learning events - parent notifications
  DIAGNOSTIC_COMPLETE:       '{name} completed their diagnostic - Spinzy Academy',
  PLAN_GENERATED:            "{name}'s personalised learning plan is ready - Spinzy Academy",
  SESSION_COMPLETE:          '{name} completed a learning session today - Spinzy Academy',
  SESSION_COMPLETE_PARENT:   '{name} completed a learning session today - Spinzy Academy',
  SESSION_MISSED:            'Give {name} a nudge - Spinzy Academy',

  // Payments
  PAYMENT_RECEIPT:           'Payment confirmed - Spinzy Academy',

  // Ongoing engagement
  WEEKLY_DIGEST:             "{name}'s weekly learning report - Spinzy Academy",
  INACTIVITY_NUDGE:          'Give {name} a nudge - Spinzy Academy',
  TRIAL_ENDING:              'Your free sessions end soon - Spinzy Academy',
  MILESTONE:                 '{name} unlocked a milestone - Spinzy Academy',

  // Admin / system
  DISTRESS_ALERT:            'Student wellbeing alert - Spinzy Academy',
  COST_ANOMALY:              'Cost anomaly detected - Spinzy Academy',
  CONTENT_JOB_FAILURE:       'Content generation failure - Spinzy Academy',
  DIAGNOSTIC_READY:          'Diagnostic ready for {name} - Spinzy Academy',
  ACCOUNT_DELETION:          'Your Spinzy Academy account has been deleted',

  // Notification architecture (09_notification_architecture.md)
  STUDENT_WELCOME:           'Welcome to Vidya, {name}!',
  STUDENT_PLAN_READY:        'Your personalised learning plan is ready',
  STUDENT_DISENGAGED:        "Let's build momentum again, {name} - Spinzy Academy",
  STUDENT_IMPROVEMENT:       'Your {concept} accuracy improved! - Spinzy Academy',
  STUDENT_EXAM_COUNTDOWN:    'Exam in 30 days -- your revision plan is ready',
  STUDENT_EXAM_RISK:         'Focus area detected for your exam - Spinzy Academy',
  STUDENT_MOCK_FEEDBACK:     'Your mock test results are in - Spinzy Academy',
  STUDENT_SECURITY_ALERT:    'Security notice - Spinzy Academy',
  STUDENT_NEW_DEVICE:        'New sign-in to your Spinzy Academy account',

  PARENT_PLAN_GENERATED:     "{name}'s learning plan is ready - Spinzy Academy",
  PARENT_MISSED_THREE_DAYS:  'Give {name} a nudge - Spinzy Academy',
  PARENT_DISENGAGED:         "{name}'s learning journey is paused - Spinzy Academy",
  PARENT_IMPROVEMENT:        '{name} made real progress this week! - Spinzy Academy',
  PARENT_EXAM_COUNTDOWN:     "{name}'s exam is in 30 days - Spinzy Academy",
  PARENT_REVISION_PLAN:      "{name}'s revision plan is ready - Spinzy Academy",
  PARENT_MOCK_SUMMARY:       "{name}'s mock test summary - Spinzy Academy",
  PARENT_EXAM_RISK:          'Action needed: {name} needs extra focus - Spinzy Academy',
  PARENT_WEEKLY_REPORT:      "{name}'s Weekly Learning Report - Week of {date}",
  PARENT_MONTHLY_REPORT:     "{name}'s Monthly Progress Report - {date}",
  PARENT_TRIAL_ENDING:       "Continue {name}'s learning journey - Spinzy Academy",
  PARENT_TRIAL_ENDED:        "Don't pause {name}'s progress - Spinzy Academy",
  PARENT_PAYMENT_SUCCESS:    'Payment confirmed - Spinzy Academy',
  PARENT_PAYMENT_FAILED:     'Action needed: payment issue - Spinzy Academy',
  PARENT_SECURITY_ALERT:     'Security notice for your Spinzy Academy account',
  PARENT_NEW_DEVICE:         'New sign-in detected - Spinzy Academy',
  PARENT_DAILY_DIGEST:       "{name}'s learning update for today",
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
  AUTH:                'auth',
  DIAGNOSTIC_COMPLETE: 'diagnostic_complete',
  PLAN_GENERATED:      'plan_generated',
  SESSION_COMPLETE:    'session_complete',
  SESSION_MISSED:      'session_missed',
} as const;

export type ParentNotifEvent = (typeof PARENT_NOTIF_EVENTS)[keyof typeof PARENT_NOTIF_EVENTS];

// ── Notification event types (full catalog matching NotificationEventType enum) ──

export const NOTIFICATION_EVENT_TYPES = {
  SIGNUP_COMPLETED:       'SIGNUP_COMPLETED',
  DIAGNOSTIC_COMPLETED:   'DIAGNOSTIC_COMPLETED',
  PLAN_GENERATED:         'PLAN_GENERATED',
  DAILY_REMINDER:         'DAILY_REMINDER',
  STUDY_COMPLETED:        'STUDY_COMPLETED',
  STREAK_MILESTONE:       'STREAK_MILESTONE',
  WEAK_TOPIC_SINGLE:      'WEAK_TOPIC_SINGLE',
  WEAK_TOPIC_PATTERN:     'WEAK_TOPIC_PATTERN',
  IMPROVEMENT_DETECTED:   'IMPROVEMENT_DETECTED',
  CONCEPT_MASTERED:       'CONCEPT_MASTERED',
  MISSED_ONE_DAY:         'MISSED_ONE_DAY',
  MISSED_THREE_DAYS:      'MISSED_THREE_DAYS',
  DISENGAGED_CRITICAL:    'DISENGAGED_CRITICAL',
  EXAM_COUNTDOWN:         'EXAM_COUNTDOWN',
  REVISION_PLAN_READY:    'REVISION_PLAN_READY',
  MOCK_TEST_SCHEDULED:    'MOCK_TEST_SCHEDULED',
  MOCK_TEST_COMPLETED:    'MOCK_TEST_COMPLETED',
  EXAM_RISK_ALERT:        'EXAM_RISK_ALERT',
  CONFUSION_PATTERN:      'CONFUSION_PATTERN',
  DAILY_DIGEST:           'DAILY_DIGEST',
  WEEKLY_REPORT:          'WEEKLY_REPORT',
  MONTHLY_REPORT:         'MONTHLY_REPORT',
  TRIAL_ENDING:           'TRIAL_ENDING',
  TRIAL_ENDED:            'TRIAL_ENDED',
  PAYMENT_SUCCESS:        'PAYMENT_SUCCESS',
  PAYMENT_FAILED:         'PAYMENT_FAILED',
  SECURITY_ALERT:         'SECURITY_ALERT',
  NEW_DEVICE_LOGIN:       'NEW_DEVICE_LOGIN',
} as const;

export type NotificationEventTypeKey = keyof typeof NOTIFICATION_EVENT_TYPES;
export type NotificationEventTypeValue = (typeof NOTIFICATION_EVENT_TYPES)[NotificationEventTypeKey];
