/**
 * lib/whatsapp/templates.ts
 * WhatsApp Business message templates for all system-generated nudges.
 *
 * IMPORTANT -- Meta Business API requirements:
 *   1. Every template must be submitted to Meta for approval before production use.
 *   2. Template name must exactly match the approved name in the WABA console.
 *   3. Language code must match the approved language (e.g. "en" or "en_IN").
 *   4. Parameters are positional -- {{1}}, {{2}}, etc. in the approved template body.
 *
 * HOW TO REGISTER:
 *   Business Manager -> WhatsApp Manager -> Message Templates -> Create Template
 *   Category: UTILITY (for nudges/notifications) or MARKETING (for trial conversion).
 *
 * Template design rules:
 *   - Max 1024 chars for body
 *   - Emojis are allowed and improve open rates
 *   - Always include a CTA (link or quick-reply button)
 *   - Forward-looking tone: no "failed", "missed", "broke"
 */

import type { WaTemplateMessage } from '@/lib/whatsapp/sender';

// ── Trial nudges ──────────────────────────────────────────────────────────────

export const TRIAL_TEMPLATES = {
  DAY_2: {
    key: 'spinzy_trial_day2',
    templateName: 'spinzy_trial_day2',
    language: 'en',
    description: 'Progress nudge on day 2 of trial -- keeps momentum going',
    bodyText:
      'Hi {{1}}! Your child *{{2}}* solved {{3}} questions in just 2 days. Keep the streak going -- try the 10-minute Quick Practice now:\n{{4}}\n\n_Spinzy Academy -- AI Home Tutor_',
  },
  DAY_5: {
    key: 'spinzy_trial_day5',
    templateName: 'spinzy_trial_day5',
    language: 'en',
    description: 'Weak area + action nudge at day 5',
    bodyText:
      "Hi {{1}}! Here is {{2}}'s progress update:\n\nStrong areas: *{{3}}*\nNeeds more practice: *{{4}}*\n\nSuggested: 3 practice sets today -> start here:\n{{5}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },
  DAY_12: {
    key: 'spinzy_trial_day12',
    templateName: 'spinzy_trial_day12',
    language: 'en',
    description: 'Trial ending urgency nudge with price',
    bodyText:
      "Hi {{1}}! {{2}}'s 14-day trial ends in 2 days. Continue learning for just Rs.399/month (no hidden charges).\n\nUpgrade now:\n{{3}}\n\n_Spinzy Academy -- AI Home Tutor_",
  },
};

// ── Inactivity nudges ─────────────────────────────────────────────────────────

export const INACTIVITY_TEMPLATE = {
  key: 'spinzy_inactivity_nudge',
  templateName: 'spinzy_inactivity_nudge',
  language: 'en',
  description: 'Sent to parent when student has not studied for N days',
  bodyText:
    'Hi {{1}}! {{2}} has not had a study session in {{3}} days. Even 10 minutes today can build the habit back.\n\nOpen Spinzy now:\n{{4}}\n\n_Spinzy Academy -- AI Home Tutor_',
};

// ── Weekly digest ─────────────────────────────────────────────────────────────

export const DIGEST_TEMPLATE = {
  key: 'spinzy_weekly_digest',
  templateName: 'spinzy_weekly_digest',
  language: 'en',
  description: 'Weekly summary sent to parent every Sunday',
  bodyText:
    "Hi {{1}}! Here is {{2}}'s weekly learning report:\n\nStudy days this week: *{{3}} / 7*\nCurrent streak: *{{4}} days*\nBest subject: *{{5}}*\n\nView the full report:\n{{6}}\n\n_Spinzy Academy -- AI Home Tutor_",
};

// ── Milestone notifications ───────────────────────────────────────────────────

export const MILESTONE_TEMPLATE = {
  key: 'spinzy_milestone',
  templateName: 'spinzy_milestone',
  language: 'en',
  description: 'Sent when student hits a learning milestone',
  bodyText:
    'Great news, {{1}}! {{2}} just achieved: *{{3}}*\n\nEvery milestone is one step closer to exam readiness. Keep celebrating the small wins!\n\nView progress:\n{{4}}\n\n_Spinzy Academy -- AI Home Tutor_',
};

// ── Welcome message ───────────────────────────────────────────────────────────

export const WELCOME_TEMPLATE = {
  key: 'spinzy_welcome',
  templateName: 'spinzy_welcome',
  language: 'en',
  description: 'Sent after student completes onboarding',
  bodyText:
    'Welcome to Spinzy Academy, {{1}}! Teacher Vidya is ready to build your personalised learning plan.\n\nStart your diagnostic test now:\n{{2}}\n\n_Questions? Reply to this message._',
};

// ── Admin custom message ──────────────────────────────────────────────────────

export const ADMIN_CUSTOM_TEMPLATE = {
  key: 'spinzy_admin_custom',
  templateName: 'spinzy_admin_custom',
  language: 'en',
  description: 'Admin-triggered custom message to a specific user or audience',
  bodyText: '{{1}}\n\n_Spinzy Academy -- AI Home Tutor_\n_To stop messages, reply STOP._',
};

// ── Builder helpers ───────────────────────────────────────────────────────────

/**
 * Build a WaTemplateMessage for the inactivity nudge.
 */
export function buildInactivityTemplate(
  parentName: string,
  studentName: string,
  inactiveDays: number,
  dashboardUrl: string
): WaTemplateMessage {
  return {
    name: INACTIVITY_TEMPLATE.templateName,
    language: INACTIVITY_TEMPLATE.language,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: parentName },
          { type: 'text', text: studentName },
          { type: 'text', text: String(inactiveDays) },
          { type: 'text', text: dashboardUrl },
        ],
      },
    ],
  };
}

/**
 * Build a WaTemplateMessage for the weekly digest.
 */
export function buildDigestTemplate(
  parentName: string,
  studentName: string,
  daysActive: number,
  streakDays: number,
  bestSubject: string,
  reportUrl: string
): WaTemplateMessage {
  return {
    name: DIGEST_TEMPLATE.templateName,
    language: DIGEST_TEMPLATE.language,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: parentName },
          { type: 'text', text: studentName },
          { type: 'text', text: String(daysActive) },
          { type: 'text', text: String(streakDays) },
          { type: 'text', text: bestSubject },
          { type: 'text', text: reportUrl },
        ],
      },
    ],
  };
}

/**
 * Build a WaTemplateMessage for a milestone notification.
 */
export function buildMilestoneTemplate(
  parentName: string,
  studentName: string,
  milestoneLabel: string,
  dashboardUrl: string
): WaTemplateMessage {
  return {
    name: MILESTONE_TEMPLATE.templateName,
    language: MILESTONE_TEMPLATE.language,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: parentName },
          { type: 'text', text: studentName },
          { type: 'text', text: milestoneLabel },
          { type: 'text', text: dashboardUrl },
        ],
      },
    ],
  };
}

/**
 * Build a WaTemplateMessage for the trial day-2 nudge.
 */
export function buildTrialDay2Template(
  parentName: string,
  studentName: string,
  questionsCount: number,
  practiceUrl: string
): WaTemplateMessage {
  return {
    name: TRIAL_TEMPLATES.DAY_2.templateName,
    language: TRIAL_TEMPLATES.DAY_2.language,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: parentName },
          { type: 'text', text: studentName },
          { type: 'text', text: String(questionsCount) },
          { type: 'text', text: practiceUrl },
        ],
      },
    ],
  };
}

/**
 * Build an admin custom-message template payload.
 */
export function buildAdminCustomTemplate(messageBody: string): WaTemplateMessage {
  return {
    name: ADMIN_CUSTOM_TEMPLATE.templateName,
    language: ADMIN_CUSTOM_TEMPLATE.language,
    components: [
      {
        type: 'body',
        parameters: [{ type: 'text', text: messageBody }],
      },
    ],
  };
}

export default TRIAL_TEMPLATES;
