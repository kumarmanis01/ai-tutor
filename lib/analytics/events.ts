/**
 * FILE OBJECTIVE:
 * - Canonical analytics event registry for student, parent, and admin surfaces.
 * - Exposes strongly-typed constants and utility sets used by ingestion routes and clients.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/analytics/events.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | create unified analytics event constants for student/parent/admin
 * - 2026-05-12T00:00:00Z | copilot | add shared analytics classification helpers for rollups/signals and remove redundant default export
 */

const STUDENT_ANALYTICS_EVENTS = {
  LESSON_VIEWED: 'lesson_viewed',
  LESSON_COMPLETED: 'lesson_completed',
  QUIZ_ATTEMPTED: 'quiz_attempted',
  QUIZ_PASSED: 'quiz_passed',

  SUGGESTION_SHOWN: 'suggestion.shown',
  SUGGESTION_CLICKED: 'suggestion.clicked',

  REFERRAL_REDEEM_ATTEMPT: 'referral_redeem_attempt',
  REFERRAL_REDEEM_RESULT: 'referral_redeem_result',

  EXPORT_PROGRESS_PDF: 'export_progress_pdf',

  AUTH_SIGNIN: 'student.auth.signin',
  AUTH_SIGNUP: 'student.auth.signup',

  DIAGNOSTICS_START: 'student.diagnostics.start',
  DIAGNOSTICS_END: 'student.diagnostics.end',

  LEARNING_PATH_GENERATED: 'student.learning_path.generated',
  LEARNING_PATH_ALTERED: 'student.learning_path.altered',

  FIRST_SESSION: 'student.first_session',

  SESSION_START: 'student.session.start',
  SESSION_COMPLETE: 'student.session.complete',
  SESSION_PHASES: 'student.session.phases',

  PRACTICE_MORE: 'student.practice_more',

  XP_CHANGED: 'student.xp.changed',

  LEADERBOARD_POSITION_CHANGE: 'student.leaderboard.position_change',

  BADGE_NEW_BADGE: 'student.badge.new_badge',
  BADGE_SHARE_BADGE: 'student.badge.share_badge',
  BADGE_SHARE_PLATFORM: 'student.badge.share_platform',

  STREAK_UPDATED: 'student.streak.updated',

  DOUBTS_ASKED: 'student.doubts.asked',
  DOUBTS_THUMBSUP: 'student.doubts.thumbsup',
  DOUBTS_THUMBSDOWN: 'student.doubts.thumbsdown',

  PAYMENT_PAYWALL_SHOWN: 'student.payment.paywall_shown',
  PAYMENT_SUCCESS: 'student.payment.success',
  PAYMENT_FAILURE: 'student.payment.failure',
  PAYMENT_SKIPPED: 'student.payment.skipped',
  PAYMENT_INITIATED: 'student.payment.initiated',
  PAYMENT_METHOD: 'student.payment.method',

  STUDY_GAP_DAYS: 'student.study_gap.days',

  DAILY_SESSION_DURATION: 'student.daily_session.duration',
  DAILY_SESSION_XP_CHANGE: 'student.daily_session.xp_change',
  DAILY_SESSION_LESSONS_COMPLETED: 'student.daily_session.lessons_completed',
  DAILY_SESSION_PENDING: 'student.daily_session.pending',
  DAILY_SESSION_TODAYS_TASK_COMPLETION: 'student.daily_session.todays_task_completion',

  ON_DEMAND_CONTENT_GENERATION_SUCCESS: 'student.on_demand_content_generation.success',
  ON_DEMAND_CONTENT_GENERATION_FAILURE: 'student.on_demand_content_generation.failure',

  CONTENT_THUMBSUP: 'student.content.thumbsup',
  CONTENT_THUMBSDOWN: 'student.content.thumbsdown',

  APP_OPEN: 'student.app.open',
  APP_CLOSE: 'student.app.close',
} as const;

const PARENT_ANALYTICS_EVENTS = {
  LINKED: 'parent.linked',
  CHANNEL_VERIFIED_CHANNEL: 'parent.channel_verified.channel',

  LEARNING_PATH_OBSERVED: 'parent.learning_path.observed',
  LEARNING_PATH_CHANGED: 'parent.learning_path.changed',

  DAILY_SESSION: 'parent.daily_session',

  APP_OPEN: 'parent.app.open',
  APP_CLOSE: 'parent.app.close',
} as const;

const ADMIN_ANALYTICS_EVENTS = {
  CONTENT_GENERATION_SUCCESS: 'admin.content_generation.success',
  CONTENT_GENERATION_FAILURE: 'admin.content_generation.failure',

  HEALTH_CHANGES: 'admin.health.changes',

  APP_OPEN: 'admin.app.open',
  APP_CLOSE: 'admin.app.close',

  CONTENT_START_GENERATION_JOB: 'admin.content.start_generation_job',
  CONTENT_SUCCESS_FAILURE: 'admin.content.success_failure',
  CONTENT_MODERATION: 'admin.content.moderation',
  CONTENT_REVIEW: 'admin.content.review',
  CONTENT_REJECT: 'admin.content.reject',
  CONTENT_APPROVE: 'admin.content.approve',
} as const;

export type StudentAnalyticsEvent =
  (typeof STUDENT_ANALYTICS_EVENTS)[keyof typeof STUDENT_ANALYTICS_EVENTS];
export type ParentAnalyticsEvent =
  (typeof PARENT_ANALYTICS_EVENTS)[keyof typeof PARENT_ANALYTICS_EVENTS];
export type AdminAnalyticsEvent =
  (typeof ADMIN_ANALYTICS_EVENTS)[keyof typeof ADMIN_ANALYTICS_EVENTS];

export type AnalyticsEventName =
  | StudentAnalyticsEvent
  | ParentAnalyticsEvent
  | AdminAnalyticsEvent;

export const ANALYTICS_EVENTS = {
  STUDENT: STUDENT_ANALYTICS_EVENTS,
  PARENT: PARENT_ANALYTICS_EVENTS,
  ADMIN: ADMIN_ANALYTICS_EVENTS,
} as const;

export const STUDENT_ANALYTICS_EVENT_SET: ReadonlySet<string> = new Set(
  Object.values(STUDENT_ANALYTICS_EVENTS),
);
export const PARENT_ANALYTICS_EVENT_SET: ReadonlySet<string> = new Set(
  Object.values(PARENT_ANALYTICS_EVENTS),
);
export const ADMIN_ANALYTICS_EVENT_SET: ReadonlySet<string> = new Set(
  Object.values(ADMIN_ANALYTICS_EVENTS),
);

export const ALL_ANALYTICS_EVENT_SET: ReadonlySet<string> = new Set([
  ...STUDENT_ANALYTICS_EVENT_SET,
  ...PARENT_ANALYTICS_EVENT_SET,
  ...ADMIN_ANALYTICS_EVENT_SET,
]);

export const ANALYTICS_SIGNAL_EVENT_PREFIX = 'signal.';

export const ANALYTICS_VIEW_EVENT_SET: ReadonlySet<string> = new Set([
  ANALYTICS_EVENTS.STUDENT.LESSON_VIEWED,
]);

export const ANALYTICS_COMPLETION_EVENT_SET: ReadonlySet<string> = new Set([
  ANALYTICS_EVENTS.STUDENT.LESSON_COMPLETED,
]);

export function isSignalEventType(eventType: string): boolean {
  return eventType.startsWith(ANALYTICS_SIGNAL_EVENT_PREFIX);
}
