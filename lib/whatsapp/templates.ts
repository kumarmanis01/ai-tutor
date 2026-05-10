/**
 * FILE OBJECTIVE:
 * - Centralized WhatsApp template management for all notification-driven messages.
 *   Defines WHATSAPP_TEMPLATES catalog, sendWhatsApp(), and sendWhatsAppBatch()
 *   as required by AC-02 of the notification architecture
 *   (docs/v2/09_notification_architecture.md).
 * - IMPORTANT: Every template must be submitted to Meta for approval before production use.
 *   Template names must exactly match the approved name in the WABA console.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/whatsapp/templates.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | staff-engineer | add complete WHATSAPP_TEMPLATES catalog per 09_notification_architecture.md AC-02
 */

import type { WaTemplateMessage } from '@/lib/whatsapp/sender';
import { sendWhatsAppTemplate, sendWhatsAppSafe } from '@/lib/whatsapp/sender';
import { logger } from '@/lib/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WhatsAppTemplate {
  id: string;
  templateName: string;
  language: string;
  description: string;
  bodyText: string;
}

export interface WhatsAppTemplateContext {
  parentName?: string;
  studentName?: string;
  concept?: string;
  subjectName?: string;
  inactiveDays?: number;
  streakDays?: number;
  daysActive?: number;
  oldAccuracy?: string;
  newAccuracy?: string;
  masteryScore?: number | string;
  daysToExam?: number;
  mockWeakAreas?: string;
  amount?: string;
  deviceInfo?: string;
  dashboardUrl?: string;
  ctaUrl?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ── Template catalog ──────────────────────────────────────────────────────────
// Positional parameters: {{1}}, {{2}}, etc. -- must match Meta-approved template body.

export const WHATSAPP_TEMPLATES = {

  // ── Onboarding ──────────────────────────────────────────────────────────────

  STUDENT_WELCOME: {
    id:           'STUDENT_WELCOME',
    templateName: 'spinzy_student_welcome',
    language:     'en',
    description:  'Sent after student completes onboarding -- first session CTA',
    bodyText:     "Welcome to Vidya, {{1}}! Your personal AI tutor is ready to build your study plan.\n\nStart your diagnostic test now:\n{{2}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_WELCOME: {
    id:           'PARENT_WELCOME',
    templateName: 'spinzy_parent_welcome',
    language:     'en',
    description:  'Sent to parent after student onboarding -- trust building',
    bodyText:     "Hi {{1}}, {{2}} is now set up on Spinzy Academy with Vidya as their personal AI tutor.\n\nA personalised study plan will be ready in minutes. You will receive a weekly progress update every Sunday.\n\nView dashboard: {{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_PLAN_GENERATED: {
    id:           'PARENT_PLAN_GENERATED',
    templateName: 'spinzy_parent_plan_generated',
    language:     'en',
    description:  'Sent to parent when learning plan is generated -- parents love structured visibility',
    bodyText:     "Hi {{1}}! {{2}}'s personalised learning plan is ready on Spinzy Academy.\n\nThe plan is built around their diagnostic results and exam timeline.\n\nReview the plan: {{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  // ── Daily learning ──────────────────────────────────────────────────────────

  STUDENT_DAILY_REMINDER: {
    id:           'STUDENT_DAILY_REMINDER',
    templateName: 'spinzy_student_daily_reminder',
    language:     'en',
    description:  'Gentle daily study reminder -- sent at preferred study time or 5 PM default',
    bodyText:     "Hi {{1}}! Continue your {{2}} revision whenever you are ready. Your session is saved.\n\nResume now: {{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  // ── Streak milestones ───────────────────────────────────────────────────────

  STUDENT_STREAK_MILESTONE_3: {
    id:           'STUDENT_STREAK_MILESTONE_3',
    templateName: 'spinzy_student_streak_3',
    language:     'en',
    description:  '3-day streak milestone -- early momentum celebration',
    bodyText:     "3 days in a row, {{1}}! You are building real study habits.\n\nKeep it going? Your next session is ready when you are.\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  STUDENT_STREAK_MILESTONE_7: {
    id:           'STUDENT_STREAK_MILESTONE_7',
    templateName: 'spinzy_student_streak_7',
    language:     'en',
    description:  '7-day streak milestone -- full week celebration',
    bodyText:     "7-day streak, {{1}}! That is a full week of consistent learning.\n\nYour brain is building real momentum now. Keep it going? Your next session is waiting. \n\n_Spinzy Academy -- AI Home Tutor_",
  },

  STUDENT_STREAK_MILESTONE_14: {
    id:           'STUDENT_STREAK_MILESTONE_14',
    templateName: 'spinzy_student_streak_14',
    language:     'en',
    description:  '14-day streak milestone -- two weeks celebration',
    bodyText:     "Two weeks straight, {{1}}! A 14-day streak is something to be proud of.\n\nThis consistency is exactly what builds exam confidence. Your next session is ready.\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  STUDENT_STREAK_MILESTONE_30: {
    id:           'STUDENT_STREAK_MILESTONE_30',
    templateName: 'spinzy_student_streak_30',
    language:     'en',
    description:  '30-day streak milestone -- major celebration',
    bodyText:     "30 days! {{1}}, you have achieved something remarkable.\n\nA full month of consistent learning. This is the kind of dedication that changes exam outcomes. Celebrate this -- and keep going!\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_STREAK_MILESTONE_7: {
    id:           'PARENT_STREAK_MILESTONE_7',
    templateName: 'spinzy_parent_streak_7',
    language:     'en',
    description:  'Sent to parent when student hits 7+ day streak',
    bodyText:     "Great news, {{1}}! {{2}} has maintained a {{3}}-day learning streak on Spinzy Academy.\n\nConsistent daily sessions like this build lasting exam confidence.\n\nView progress: {{4}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_STREAK_MILESTONE_30: {
    id:           'PARENT_STREAK_MILESTONE_30',
    templateName: 'spinzy_parent_streak_30',
    language:     'en',
    description:  'Sent to parent when student hits 30-day streak',
    bodyText:     "30 days in a row, {{1}}! {{2}} has been learning consistently for a full month.\n\nThis is exceptional dedication -- a real sign of growing confidence and preparation.\n\nView their progress: {{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  // ── Disengagement ───────────────────────────────────────────────────────────

  STUDENT_MISSED_THREE_DAYS: {
    id:           'STUDENT_MISSED_THREE_DAYS',
    templateName: 'spinzy_student_missed_3days',
    language:     'en',
    description:  'Supportive nudge when student misses 3 consecutive days',
    bodyText:     "Hi {{1}}, momentum matters. A 15-minute session today keeps your preparation moving forward.\n\nYour session is saved and ready: {{2}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_MISSED_THREE_DAYS: {
    id:           'PARENT_MISSED_THREE_DAYS',
    templateName: 'spinzy_parent_missed_3days',
    language:     'en',
    description:  'Sent to parent when student misses 3 consecutive days -- constructive, not alarming',
    bodyText:     "Hi {{1}}, {{2}} has not continued learning for 3 days. A small revision session today can help maintain momentum.\n\nWould you like us to send them a reminder?\n\nView plan: {{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  STUDENT_DISENGAGED_CRITICAL: {
    id:           'STUDENT_DISENGAGED_CRITICAL',
    templateName: 'spinzy_student_disengaged',
    language:     'en',
    description:  'Re-activation attempt after 7+ consecutive days without learning',
    bodyText:     "Hi {{1}}, your personalised learning plan is still here -- waiting for you.\n\nEven a 10-minute session today keeps your preparation moving. Your best learning is still ahead.\n\nResume here: {{2}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_DISENGAGED_CRITICAL: {
    id:           'PARENT_DISENGAGED_CRITICAL',
    templateName: 'spinzy_parent_disengaged',
    language:     'en',
    description:  'Escalation to parent after 7+ days of severe student disengagement',
    bodyText:     "Hi {{1}}, {{2}}'s learning journey has been paused for {{3}} days. A short session today -- even 15 minutes -- can rebuild momentum.\n\nVidya would love to continue together. View their plan:\n{{4}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  // ── Performance ─────────────────────────────────────────────────────────────

  STUDENT_IMPROVEMENT_DETECTED: {
    id:           'STUDENT_IMPROVEMENT_DETECTED',
    templateName: 'spinzy_student_improvement',
    language:     'en',
    description:  'Celebration when student accuracy jumps 25%+ in a concept',
    bodyText:     "Your {{1}} accuracy jumped from {{2}} to {{3}}, {{4}}!\n\nThat is real progress. You are understanding it now. Keep this momentum!\n\nNext up: {{5}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_IMPROVEMENT_DETECTED: {
    id:           'PARENT_IMPROVEMENT_DETECTED',
    templateName: 'spinzy_parent_improvement',
    language:     'en',
    description:  'Visible proof of improvement sent to parent -- psychologically very important',
    bodyText:     "Great news, {{1}}! {{2}}'s accuracy in {{3}} improved from {{4}} to {{5}}.\n\nConsistent practice is paying off. Vidya is keeping the momentum going.\n\nView progress: {{6}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  STUDENT_WEAK_TOPIC_PATTERN: {
    id:           'STUDENT_WEAK_TOPIC_PATTERN',
    templateName: 'spinzy_student_weak_topic',
    language:     'en',
    description:  'Sent when a weak topic pattern (3+ attempts, <40% avg) is detected',
    bodyText:     "Hi {{1}}! {{2}} is a bit tricky right now -- and that is completely normal.\n\nVidya has prepared focused practice sessions just for this. 2--3 sessions can change this significantly.\n\nStart practice: {{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_WEAK_TOPIC_EXAM: {
    id:           'PARENT_WEAK_TOPIC_EXAM',
    templateName: 'spinzy_parent_weak_topic_exam',
    language:     'en',
    description:  'Alert to parent when weak topic is exam-related and exam < 30 days away',
    bodyText:     "Hi {{1}}, Vidya noticed that {{2}} ({{3}}% of {{4}}'s exam) needs more focus. Current mastery: {{5}}%.\n\nA focused practice plan is ready. 2--3 sessions can boost this significantly.\n\nView plan: {{6}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  // ── Exam preparation ────────────────────────────────────────────────────────

  STUDENT_EXAM_COUNTDOWN: {
    id:           'STUDENT_EXAM_COUNTDOWN',
    templateName: 'spinzy_student_exam_countdown',
    language:     'en',
    description:  'Sent when exam is 30 days away -- activates exam mode psychology',
    bodyText:     "Hi {{1}}! Your exam is {{2}} days away. Vidya has activated focused exam preparation mode.\n\nYour revision plan is ready -- built around your personal weak areas and high-weightage topics.\n\nStart revision: {{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_EXAM_COUNTDOWN: {
    id:           'PARENT_EXAM_COUNTDOWN',
    templateName: 'spinzy_parent_exam_countdown',
    language:     'en',
    description:  'Sent to parent when exam is 30 days away -- aligns expectations',
    bodyText:     "Hi {{1}}! {{2}}'s exam is {{3}} days away. Vidya has activated exam preparation mode.\n\nCurrent readiness: {{4}}%. Consistent sessions now will make the biggest difference.\n\nView revision plan: {{5}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_REVISION_PLAN_READY: {
    id:           'PARENT_REVISION_PLAN_READY',
    templateName: 'spinzy_parent_revision_plan',
    language:     'en',
    description:  'Sent to parent when exam revision plan is generated -- high engagement',
    bodyText:     "Hi {{1}}! {{2}}'s personalised exam revision plan is ready.\n\nIt covers high-weightage topics and personal weak areas with realistic daily targets.\n\nReview the plan: {{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  STUDENT_EXAM_RISK_ALERT: {
    id:           'STUDENT_EXAM_RISK_ALERT',
    templateName: 'spinzy_student_exam_risk',
    language:     'en',
    description:  'Constructive alert when exam risk score > 0.6',
    bodyText:     "Hi {{1}}! {{2}} accounts for {{3}}% of your exam. Current mastery: {{4}}%.\n\nLet's focus here -- 2--3 sessions can boost your score significantly.\n\nStart now: {{5}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_EXAM_RISK_ALERT: {
    id:           'PARENT_EXAM_RISK_ALERT',
    templateName: 'spinzy_parent_exam_risk',
    language:     'en',
    description:  'Professional escalation to parent when exam risk is high',
    bodyText:     "Hi {{1}}, Vidya noticed that {{2}} ({{3}}% of {{4}}'s exam) needs more focus. Current mastery: {{5}}%.\n\nA focused practice plan is ready. 2--3 sessions can boost this significantly.\n\nWould you like to review the plan?\n{{6}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  STUDENT_MOCK_FEEDBACK: {
    id:           'STUDENT_MOCK_FEEDBACK',
    templateName: 'spinzy_student_mock_feedback',
    language:     'en',
    description:  'In-app CTA after mock test completion -- directs to detailed feedback',
    bodyText:     "Hi {{1}}! Your mock test results are in.\n\nVidya has prepared personalised feedback and a practice plan based on your results.\n\nReview now: {{2}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_MOCK_SUMMARY: {
    id:           'PARENT_MOCK_SUMMARY',
    templateName: 'spinzy_parent_mock_summary',
    language:     'en',
    description:  'Summary sent to parent within 1 hour of mock test completion',
    bodyText:     "Hi {{1}}! {{2}} completed a mock test. Strong areas: {{3}}. Focus areas: {{4}}.\n\nVidya has prepared targeted practice sessions to address the focus areas.\n\nView full report: {{5}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  // ── Billing ─────────────────────────────────────────────────────────────────

  PARENT_TRIAL_ENDING: {
    id:           'PARENT_TRIAL_ENDING',
    templateName: 'spinzy_parent_trial_ending',
    language:     'en',
    description:  'Value-based trial ending nudge -- not fear-based',
    bodyText:     "Hi {{1}}! {{2}}'s learning journey has just begun. Continue with a Rs.399/month plan -- no hidden charges.\n\nUpgrade now:\n{{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_PAYMENT_FAILED: {
    id:           'PARENT_PAYMENT_FAILED',
    templateName: 'spinzy_parent_payment_failed',
    language:     'en',
    description:  'High-priority payment failure alert -- supportive, action-oriented',
    bodyText:     "Hi {{1}}, we were unable to process your recent payment. Please update your payment method to continue {{2}}'s learning.\n\nUpdate now:\n{{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  PARENT_PAYMENT_SUCCESS: {
    id:           'PARENT_PAYMENT_SUCCESS',
    templateName: 'spinzy_parent_payment_success',
    language:     'en',
    description:  'Payment confirmation with invoice details',
    bodyText:     "Hi {{1}}, your payment of {{2}} has been confirmed. {{3}}'s learning continues uninterrupted.\n\nNext billing: {{4}}\n\nView dashboard: {{5}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  // ── Legacy templates (existing, kept for backwards compatibility) ────────────

  INACTIVITY_NUDGE: {
    id:           'INACTIVITY_NUDGE',
    templateName: 'spinzy_inactivity_nudge',
    language:     'en',
    description:  'Sent to parent when student has not studied for N days',
    bodyText:     "Hi {{1}}! {{2}} has not had a study session in {{3}} days. Even 10 minutes today can build the habit back.\n\nOpen Spinzy now:\n{{4}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  WEEKLY_DIGEST: {
    id:           'WEEKLY_DIGEST',
    templateName: 'spinzy_weekly_digest',
    language:     'en',
    description:  "Weekly summary sent to parent every Sunday",
    bodyText:     "Hi {{1}}! Here is {{2}}'s weekly learning report:\n\nStudy days this week: *{{3}} / 7*\nCurrent streak: *{{4}} days*\nBest subject: *{{5}}*\n\nView the full report:\n{{6}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  MILESTONE: {
    id:           'MILESTONE',
    templateName: 'spinzy_milestone',
    language:     'en',
    description:  'Sent when student hits a learning milestone',
    bodyText:     "Great news, {{1}}! {{2}} just achieved: *{{3}}*\n\nEvery milestone is one step closer to exam readiness. Keep celebrating the small wins!\n\nView progress:\n{{4}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },

  ADMIN_CUSTOM: {
    id:           'ADMIN_CUSTOM',
    templateName: 'spinzy_admin_custom',
    language:     'en',
    description:  'Admin-triggered custom message to a specific user or audience',
    bodyText:     "{{1}}\n\n_Spinzy Academy -- AI Home Tutor_\n_To stop messages, reply STOP._",
  },

} as const satisfies Record<string, WhatsAppTemplate>;

// ── Builder helpers ───────────────────────────────────────────────────────────

function buildTemplate(
  templateName: string,
  language: string,
  params: string[],
): WaTemplateMessage {
  return {
    name: templateName,
    language,
    components: [
      {
        type: 'body',
        parameters: params.map((text) => ({ type: 'text' as const, text })),
      },
    ],
  };
}

export function buildStudentWelcomeTemplate(
  studentName: string,
  ctaUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.STUDENT_WELCOME.templateName, WHATSAPP_TEMPLATES.STUDENT_WELCOME.language, [studentName, ctaUrl]);
}

export function buildParentWelcomeTemplate(
  parentName: string,
  studentName: string,
  dashboardUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.PARENT_WELCOME.templateName, WHATSAPP_TEMPLATES.PARENT_WELCOME.language, [parentName, studentName, dashboardUrl]);
}

export function buildParentPlanGeneratedTemplate(
  parentName: string,
  studentName: string,
  dashboardUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.PARENT_PLAN_GENERATED.templateName, WHATSAPP_TEMPLATES.PARENT_PLAN_GENERATED.language, [parentName, studentName, dashboardUrl]);
}

export function buildStudentDailyReminderTemplate(
  studentName: string,
  subjectName: string,
  ctaUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.STUDENT_DAILY_REMINDER.templateName, WHATSAPP_TEMPLATES.STUDENT_DAILY_REMINDER.language, [studentName, subjectName, ctaUrl]);
}

export function buildStudentStreakMilestoneTemplate(
  days: 3 | 7 | 14 | 30,
  studentName: string,
  ctaUrl?: string,
): WaTemplateMessage {
  const key = `STUDENT_STREAK_MILESTONE_${days}` as keyof typeof WHATSAPP_TEMPLATES;
  const t = WHATSAPP_TEMPLATES[key] as WhatsAppTemplate;
  const params = days === 7 || days === 14 || days === 30
    ? [studentName]
    : [studentName];
  if (ctaUrl) params.push(ctaUrl);
  return buildTemplate(t.templateName, t.language, params);
}

export function buildParentStreakMilestoneTemplate(
  parentName: string,
  studentName: string,
  streakDays: number,
  dashboardUrl: string,
): WaTemplateMessage {
  const key = streakDays >= 30 ? 'PARENT_STREAK_MILESTONE_30' : 'PARENT_STREAK_MILESTONE_7';
  const t = WHATSAPP_TEMPLATES[key] as WhatsAppTemplate;
  if (key === 'PARENT_STREAK_MILESTONE_30') {
    return buildTemplate(t.templateName, t.language, [parentName, studentName, dashboardUrl]);
  }
  return buildTemplate(t.templateName, t.language, [parentName, studentName, String(streakDays), dashboardUrl]);
}

export function buildStudentMissedThreeDaysTemplate(
  studentName: string,
  ctaUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.STUDENT_MISSED_THREE_DAYS.templateName, WHATSAPP_TEMPLATES.STUDENT_MISSED_THREE_DAYS.language, [studentName, ctaUrl]);
}

export function buildParentMissedThreeDaysTemplate(
  parentName: string,
  studentName: string,
  dashboardUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.PARENT_MISSED_THREE_DAYS.templateName, WHATSAPP_TEMPLATES.PARENT_MISSED_THREE_DAYS.language, [parentName, studentName, dashboardUrl]);
}

export function buildStudentDisengagedTemplate(
  studentName: string,
  ctaUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.STUDENT_DISENGAGED_CRITICAL.templateName, WHATSAPP_TEMPLATES.STUDENT_DISENGAGED_CRITICAL.language, [studentName, ctaUrl]);
}

export function buildParentDisengagedTemplate(
  parentName: string,
  studentName: string,
  inactiveDays: number,
  dashboardUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.PARENT_DISENGAGED_CRITICAL.templateName, WHATSAPP_TEMPLATES.PARENT_DISENGAGED_CRITICAL.language, [parentName, studentName, String(inactiveDays), dashboardUrl]);
}

export function buildStudentImprovementTemplate(
  concept: string,
  oldAccuracy: string,
  newAccuracy: string,
  studentName: string,
  nextConcept: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.STUDENT_IMPROVEMENT_DETECTED.templateName, WHATSAPP_TEMPLATES.STUDENT_IMPROVEMENT_DETECTED.language, [concept, oldAccuracy, newAccuracy, studentName, nextConcept]);
}

export function buildParentImprovementTemplate(
  parentName: string,
  studentName: string,
  concept: string,
  oldAccuracy: string,
  newAccuracy: string,
  dashboardUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.PARENT_IMPROVEMENT_DETECTED.templateName, WHATSAPP_TEMPLATES.PARENT_IMPROVEMENT_DETECTED.language, [parentName, studentName, concept, oldAccuracy, newAccuracy, dashboardUrl]);
}

export function buildStudentExamCountdownTemplate(
  studentName: string,
  daysToExam: number,
  ctaUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.STUDENT_EXAM_COUNTDOWN.templateName, WHATSAPP_TEMPLATES.STUDENT_EXAM_COUNTDOWN.language, [studentName, String(daysToExam), ctaUrl]);
}

export function buildParentExamCountdownTemplate(
  parentName: string,
  studentName: string,
  daysToExam: number,
  readinessPct: string,
  dashboardUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.PARENT_EXAM_COUNTDOWN.templateName, WHATSAPP_TEMPLATES.PARENT_EXAM_COUNTDOWN.language, [parentName, studentName, String(daysToExam), readinessPct, dashboardUrl]);
}

export function buildParentRevisionPlanReadyTemplate(
  parentName: string,
  studentName: string,
  dashboardUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.PARENT_REVISION_PLAN_READY.templateName, WHATSAPP_TEMPLATES.PARENT_REVISION_PLAN_READY.language, [parentName, studentName, dashboardUrl]);
}

export function buildStudentExamRiskTemplate(
  studentName: string,
  concept: string,
  weightPct: string,
  currentMastery: string,
  ctaUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.STUDENT_EXAM_RISK_ALERT.templateName, WHATSAPP_TEMPLATES.STUDENT_EXAM_RISK_ALERT.language, [studentName, concept, weightPct, currentMastery, ctaUrl]);
}

export function buildParentExamRiskTemplate(
  parentName: string,
  concept: string,
  weightPct: string,
  studentName: string,
  currentMastery: string,
  dashboardUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.PARENT_EXAM_RISK_ALERT.templateName, WHATSAPP_TEMPLATES.PARENT_EXAM_RISK_ALERT.language, [parentName, concept, weightPct, studentName, currentMastery, dashboardUrl]);
}

export function buildParentTrialEndingTemplate(
  parentName: string,
  studentName: string,
  upgradeUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.PARENT_TRIAL_ENDING.templateName, WHATSAPP_TEMPLATES.PARENT_TRIAL_ENDING.language, [parentName, studentName, upgradeUrl]);
}

export function buildParentPaymentFailedTemplate(
  parentName: string,
  studentName: string,
  billingUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.PARENT_PAYMENT_FAILED.templateName, WHATSAPP_TEMPLATES.PARENT_PAYMENT_FAILED.language, [parentName, studentName, billingUrl]);
}

export function buildParentPaymentSuccessTemplate(
  parentName: string,
  amount: string,
  studentName: string,
  nextBillingDate: string,
  dashboardUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.PARENT_PAYMENT_SUCCESS.templateName, WHATSAPP_TEMPLATES.PARENT_PAYMENT_SUCCESS.language, [parentName, amount, studentName, nextBillingDate, dashboardUrl]);
}

// Legacy builder exports kept for backwards compatibility

export function buildInactivityTemplate(
  parentName: string,
  studentName: string,
  inactiveDays: number,
  dashboardUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.INACTIVITY_NUDGE.templateName, WHATSAPP_TEMPLATES.INACTIVITY_NUDGE.language, [parentName, studentName, String(inactiveDays), dashboardUrl]);
}

export function buildDigestTemplate(
  parentName: string,
  studentName: string,
  daysActive: number,
  streakDays: number,
  bestSubject: string,
  reportUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.WEEKLY_DIGEST.templateName, WHATSAPP_TEMPLATES.WEEKLY_DIGEST.language, [parentName, studentName, String(daysActive), String(streakDays), bestSubject, reportUrl]);
}

export function buildMilestoneTemplate(
  parentName: string,
  studentName: string,
  milestoneLabel: string,
  dashboardUrl: string,
): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.MILESTONE.templateName, WHATSAPP_TEMPLATES.MILESTONE.language, [parentName, studentName, milestoneLabel, dashboardUrl]);
}

export function buildAdminCustomTemplate(messageBody: string): WaTemplateMessage {
  return buildTemplate(WHATSAPP_TEMPLATES.ADMIN_CUSTOM.templateName, WHATSAPP_TEMPLATES.ADMIN_CUSTOM.language, [messageBody]);
}

// ── Send functions ────────────────────────────────────────────────────────────

/**
 * Send a WhatsApp message using a named template from WHATSAPP_TEMPLATES.
 *
 * @param templateId - Key from WHATSAPP_TEMPLATES catalog
 * @param phoneNumber - Recipient phone number (normalized internally)
 * @param waMessage - Pre-built WaTemplateMessage (use builder helpers above)
 * @returns SendWhatsAppResult with success flag and optional messageId/error
 */
export async function sendWhatsApp(
  templateId: string,
  phoneNumber: string,
  waMessage: WaTemplateMessage,
  _options?: { priority?: 'high' | 'normal' },
): Promise<SendWhatsAppResult> {
  if (!WHATSAPP_TEMPLATES[templateId as keyof typeof WHATSAPP_TEMPLATES]) {
    logger.warn('[whatsapp/templates] unknown templateId', { templateId });
    return { success: false, error: `Unknown template: ${templateId}` };
  }

  const result = await sendWhatsAppTemplate(phoneNumber, waMessage);
  return { success: result.ok, messageId: result.messageId, error: result.error };
}

/**
 * Send a batch of WhatsApp messages. Failures are logged individually; batch continues.
 *
 * @param messages - Array of { templateId, phone, waMessage }
 * @returns Aggregate sent/failed counts
 */
export async function sendWhatsAppBatch(
  messages: Array<{ templateId: string; phone: string; waMessage: WaTemplateMessage }>,
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    messages.map(({ templateId, phone, waMessage }) =>
      sendWhatsApp(templateId, phone, waMessage),
    ),
  );

  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.success) {
      sent++;
    } else {
      failed++;
    }
  }

  logger.info('[whatsapp/templates] batch complete', { total: messages.length, sent, failed });
  return { sent, failed };
}

export { sendWhatsAppSafe };

// ── Legacy TRIAL_TEMPLATES (kept for backwards compatibility with trialNudges worker) ──

export const TRIAL_TEMPLATES = {
  DAY_2: {
    key:          'spinzy_trial_day2',
    templateName: 'spinzy_trial_day2',
    language:     'en',
    description:  'Progress nudge on day 2 of trial -- keeps momentum going',
    bodyText:     "Hi {{1}}! Your child *{{2}}* solved {{3}} questions in just 2 days. Keep the streak going -- try the 10-minute Quick Practice now:\n{{4}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },
  DAY_5: {
    key:          'spinzy_trial_day5',
    templateName: 'spinzy_trial_day5',
    language:     'en',
    description:  'Weak area + action nudge at day 5',
    bodyText:     "Hi {{1}}! Here is {{2}}'s progress update:\n\nStrong areas: *{{3}}*\nNeeds more practice: *{{4}}*\n\nSuggested: 3 practice sets today -> start here:\n{{5}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },
  DAY_12: {
    key:          'spinzy_trial_day12',
    templateName: 'spinzy_trial_day12',
    language:     'en',
    description:  'Trial ending urgency nudge with price',
    bodyText:     "Hi {{1}}! {{2}}'s 14-day trial ends in 2 days. Continue learning for just Rs.399/month (no hidden charges).\n\nUpgrade now:\n{{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },
};

/**
 * Build a WaTemplateMessage for the trial day-2 nudge.
 * Kept for backwards compatibility with worker/jobs/trialNudges.ts.
 */
export function buildTrialDay2Template(
  parentName: string,
  studentName: string,
  questionsCount: number,
  practiceUrl: string,
): WaTemplateMessage {
  return buildTemplate(TRIAL_TEMPLATES.DAY_2.templateName, TRIAL_TEMPLATES.DAY_2.language, [
    parentName,
    studentName,
    String(questionsCount),
    practiceUrl,
  ]);
}

// Default export matches legacy contract (trialNudges worker imports as: import TRIAL_TEMPLATES from ...)
export default TRIAL_TEMPLATES;
