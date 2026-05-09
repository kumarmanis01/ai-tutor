/**
 * FILE OBJECTIVE:
 * - Centralized email template management module for all notification-driven
 *   transactional emails. Defines EMAIL_TEMPLATES catalog, EMAIL_FROM constants,
 *   sendEmail(), and sendEmailBatch() as required by AC-01 of the notification
 *   architecture (docs/v2/09_notification_architecture.md).
 * - All email sending from notification events MUST go through this module.
 *   Never hardcode subjects or from-addresses at call sites.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/mail.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | staff-engineer | created centralized mail module per 09_notification_architecture.md AC-01
 */

import { sendMailSafe } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import { EMAIL_FROM as EMAIL_FROM_CONSTANTS, MAIL_SUBJECTS } from '@/lib/constants/mail';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmailTemplateContext {
  // Recipient
  recipientName?: string;
  parentName?: string;
  studentName?: string;
  // Content
  subject?: string;
  concept?: string;
  subjectName?: string;
  placement?: string;
  topicName?: string;
  // Metrics
  studyDays?: number;
  totalHours?: number;
  streakDays?: number;
  daysActive?: number;
  consistency?: number;
  oldAccuracy?: string;
  newAccuracy?: string;
  masteryScore?: number;
  examReadinessScore?: number;
  riskScore?: number;
  // Dates / time
  sessionDate?: string;
  weekOf?: string;
  daysToExam?: number;
  date?: string;
  // URLs
  dashboardUrl?: string;
  appUrl?: string;
  ctaUrl?: string;
  // Misc
  inactiveDays?: number;
  milestoneLabel?: string;
  mockWeakAreas?: string;
  mockStrengths?: string;
  plan?: string;
  deviceInfo?: string;
  ipAddress?: string;
  amount?: string;
  nextBillingDate?: string;
  invoiceUrl?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface EmailTemplate {
  id: string;
  subject: (ctx: EmailTemplateContext) => string;
  htmlBody: (ctx: EmailTemplateContext) => string;
  textBody: (ctx: EmailTemplateContext) => string;
  from: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SendEmailOptions {
  delay?: number;
  priority?: 'high' | 'normal';
}

// ── FROM addresses (re-export for convenience) ────────────────────────────────

export const EMAIL_FROM = EMAIL_FROM_CONSTANTS;

// ── Shared HTML primitives ────────────────────────────────────────────────────

const BASE_STYLE = [
  'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;',
  'max-width:520px;margin:0 auto;color:#1a1a1a;padding:0 8px;',
].join('');

const BTN_STYLE = [
  'display:inline-block;padding:12px 28px;background:#534AB7;',
  'color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;',
].join('');

const FOOTER_HTML = `
  <p style="color:#888;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
    Spinzy Academy -- AI Home Tutor<br>
    You are receiving this because you have a Spinzy account.
    <a href="https://spinzyacademy.com/unsubscribe" style="color:#888;">Unsubscribe</a>
  </p>
`;

function buildHtml(body: string): string {
  return `<div style="${BASE_STYLE}">${body}${FOOTER_HTML}</div>`;
}

function cta(text: string, url: string): string {
  return `<p><a href="${url}" style="${BTN_STYLE}">${text}</a></p>`;
}

// ── Template catalog ──────────────────────────────────────────────────────────

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {

  // ── Onboarding ──────────────────────────────────────────────────────────────

  STUDENT_WELCOME: {
    id:   'STUDENT_WELCOME',
    from: EMAIL_FROM.LEARNING,
    subject: (ctx) => MAIL_SUBJECTS.STUDENT_WELCOME.replace('{name}', ctx.studentName ?? 'there'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">Welcome to Vidya, ${ctx.studentName ?? 'there'}!</h2>
      <p>Hi ${ctx.studentName ?? 'there'},</p>
      <p>You are now set up to start your personalised learning journey. Here is what is next:</p>
      <ol>
        <li><strong>Step 1:</strong> Complete your diagnostic test -- a quick 20-minute test that helps Vidya understand where you are.</li>
        <li><strong>Step 2:</strong> Get your personalised learning plan based on your diagnostic.</li>
        <li><strong>Step 3:</strong> Start your first learning session. Vidya will guide you step by step.</li>
      </ol>
      ${cta('Start Diagnostic', ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/dashboard')}
      <p>Questions? Reply to this email or check our FAQ.</p>
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `Welcome to Vidya, ${ctx.studentName ?? 'there'}!\n\nStart your diagnostic: ${ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/dashboard'}`,
  },

  PARENT_WELCOME: {
    id:   'PARENT_WELCOME',
    from: EMAIL_FROM.NOREPLY,
    subject: (_ctx) => MAIL_SUBJECTS.PARENT_WELCOME,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">Your child is set up on Spinzy Academy</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p><strong>${ctx.studentName ?? 'Your child'}</strong> has joined Vidya, their personal AI tutor. Here is what happens next:</p>
      <ul>
        <li>Vidya will run a short diagnostic to understand ${ctx.studentName ?? "your child"}'s current level.</li>
        <li>A personalised study plan will be ready within minutes.</li>
        <li>Daily learning sessions keep the momentum going -- 20--30 minutes is all it takes.</li>
      </ul>
      <p>You will receive a weekly learning report every Sunday. No spam -- just meaningful updates.</p>
      ${cta('View Dashboard', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `Hi ${ctx.parentName ?? 'there'}, ${ctx.studentName ?? 'Your child'} is set up on Spinzy Academy. Dashboard: ${ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard'}`,
  },

  STUDENT_PLAN_READY: {
    id:   'STUDENT_PLAN_READY',
    from: EMAIL_FROM.LEARNING,
    subject: (_ctx) => MAIL_SUBJECTS.STUDENT_PLAN_READY,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">Your personalised learning plan is ready!</h2>
      <p>Hi ${ctx.studentName ?? 'there'},</p>
      <p>Vidya has built your custom study plan based on your diagnostic. It is tailored to your exam timeline and current level.</p>
      ${cta('See Your Plan', ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/dashboard')}
      <p>Ready to start your first session? Your plan is waiting.</p>
    `),
    textBody: (ctx) => `Your learning plan is ready! View it here: ${ctx.ctaUrl ?? ctx.dashboardUrl}`,
  },

  PARENT_PLAN_GENERATED: {
    id:   'PARENT_PLAN_GENERATED',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_PLAN_GENERATED.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">${ctx.studentName ?? "Your child"}'s learning plan is ready</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>Vidya has created a personalised study plan for <strong>${ctx.studentName ?? 'your child'}</strong> in <strong>${ctx.subjectName ?? 'their subjects'}</strong>.</p>
      <p>The plan is structured around ${ctx.studentName ?? "your child"}'s diagnostic results and exam timeline -- focusing on the concepts that need the most attention.</p>
      ${cta('View the Plan', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `${ctx.studentName ?? "Your child"}'s learning plan is ready. View it: ${ctx.dashboardUrl}`,
  },

  // ── Daily learning ──────────────────────────────────────────────────────────

  PARENT_DAILY_DIGEST: {
    id:   'PARENT_DAILY_DIGEST',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_DAILY_DIGEST.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">Today's learning update for ${ctx.studentName ?? 'your child'}</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <ul>
        <li>Study time today: <strong>${ctx.totalHours ?? 0} minutes</strong></li>
        <li>Topics covered: <strong>${ctx.topicName ?? 'See app for details'}</strong></li>
        <li>Current streak: <strong>${ctx.streakDays ?? 0} days</strong></li>
      </ul>
      <p>Keep it going! Check the app for details.</p>
      ${cta('View Progress', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
    `),
    textBody: (ctx) => `Today's update for ${ctx.studentName}: ${ctx.totalHours ?? 0} min studied, streak: ${ctx.streakDays ?? 0} days. ${ctx.dashboardUrl}`,
  },

  // ── Streak milestones ───────────────────────────────────────────────────────

  PARENT_STREAK_MILESTONE: {
    id:   'PARENT_STREAK_MILESTONE',
    from: EMAIL_FROM.LEARNING,
    subject: (ctx) => MAIL_SUBJECTS.MILESTONE.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#1D9E75;">${ctx.studentName ?? 'Your child'} kept a ${ctx.streakDays}-day streak!</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p><strong>${ctx.studentName ?? 'Your child'}</strong> has studied consistently for <strong>${ctx.streakDays} days in a row</strong>. That is real dedication -- and it builds lasting learning habits.</p>
      ${cta('View Progress', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `${ctx.studentName} has a ${ctx.streakDays}-day streak! View progress: ${ctx.dashboardUrl}`,
  },

  // ── Disengagement ───────────────────────────────────────────────────────────

  STUDENT_DISENGAGED_CRITICAL: {
    id:   'STUDENT_DISENGAGED_CRITICAL',
    from: EMAIL_FROM.LEARNING,
    subject: (ctx) => MAIL_SUBJECTS.STUDENT_DISENGAGED.replace('{name}', ctx.studentName ?? 'there'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">Let's continue together, ${ctx.studentName ?? 'there'}</h2>
      <p>Hi ${ctx.studentName ?? 'there'},</p>
      <p>Your personalised learning plan is still here, waiting for you. Every session -- even a short 10-minute one -- keeps your preparation moving forward.</p>
      <p>Your best learning is still ahead. Let's start fresh today.</p>
      ${cta('Resume My Learning', ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/dashboard')}
      <p>Vidya is here whenever you are ready.</p>
    `),
    textBody: (ctx) => `Let's continue together. Your learning plan is waiting: ${ctx.ctaUrl ?? ctx.dashboardUrl}`,
  },

  PARENT_DISENGAGED_CRITICAL: {
    id:   'PARENT_DISENGAGED_CRITICAL',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_DISENGAGED.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#BA7517;">${ctx.studentName ?? "Your child"}'s learning journey is paused</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p><strong>${ctx.studentName ?? 'Your child'}</strong> has not had a learning session in ${ctx.inactiveDays ?? 7} days. A short session today -- even 15 minutes -- can help rebuild the learning momentum.</p>
      <p>Vidya would love to continue together. A gentle reminder from you can go a long way.</p>
      ${cta('View Learning Plan', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `${ctx.studentName ?? "Your child"} has not studied in ${ctx.inactiveDays ?? 7} days. View their plan: ${ctx.dashboardUrl}`,
  },

  PARENT_MISSED_THREE_DAYS: {
    id:   'PARENT_MISSED_THREE_DAYS',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_MISSED_THREE_DAYS.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#BA7517;">Give ${ctx.studentName ?? 'your child'} a nudge</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p><strong>${ctx.studentName ?? 'Your child'}</strong> has not continued learning for 3 days. A small revision session today can help maintain momentum.</p>
      ${cta('View Progress', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
    `),
    textBody: (ctx) => `${ctx.studentName ?? "Your child"} has not studied in 3 days. Nudge them: ${ctx.dashboardUrl}`,
  },

  // ── Performance ─────────────────────────────────────────────────────────────

  STUDENT_IMPROVEMENT_DETECTED: {
    id:   'STUDENT_IMPROVEMENT_DETECTED',
    from: EMAIL_FROM.LEARNING,
    subject: (ctx) => MAIL_SUBJECTS.STUDENT_IMPROVEMENT.replace('{concept}', ctx.concept ?? 'your topic'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#1D9E75;">Your ${ctx.concept ?? 'topic'} accuracy is improving!</h2>
      <p>Hi ${ctx.studentName ?? 'there'},</p>
      <p>Your accuracy in <strong>${ctx.concept ?? 'this topic'}</strong> jumped from <strong>${ctx.oldAccuracy ?? '?%'}</strong> to <strong>${ctx.newAccuracy ?? '?%'}</strong>. That is real progress -- you are understanding it now.</p>
      <p>Keep this momentum going. Your next related concept is ready when you are.</p>
      ${cta('Continue Learning', ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/dashboard')}
    `),
    textBody: (ctx) => `Your ${ctx.concept} accuracy: ${ctx.oldAccuracy} to ${ctx.newAccuracy}. Keep going: ${ctx.ctaUrl ?? ctx.dashboardUrl}`,
  },

  PARENT_IMPROVEMENT_DETECTED: {
    id:   'PARENT_IMPROVEMENT_DETECTED',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_IMPROVEMENT.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#1D9E75;">${ctx.studentName ?? 'Your child'} made real progress!</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p><strong>${ctx.studentName ?? 'Your child'}</strong>'s accuracy in <strong>${ctx.concept ?? 'a key topic'}</strong> improved from <strong>${ctx.oldAccuracy ?? '?%'}</strong> to <strong>${ctx.newAccuracy ?? '?%'}</strong>.</p>
      <p>Consistent practice is paying off. Vidya is keeping the momentum going.</p>
      ${cta('View Progress', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `${ctx.studentName}'s ${ctx.concept} accuracy: ${ctx.oldAccuracy} to ${ctx.newAccuracy}. ${ctx.dashboardUrl}`,
  },

  // ── Exam preparation ────────────────────────────────────────────────────────

  STUDENT_EXAM_COUNTDOWN: {
    id:   'STUDENT_EXAM_COUNTDOWN',
    from: EMAIL_FROM.LEARNING,
    subject: (_ctx) => MAIL_SUBJECTS.STUDENT_EXAM_COUNTDOWN,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">Exam in ${ctx.daysToExam ?? 30} days -- let's focus</h2>
      <p>Hi ${ctx.studentName ?? 'there'},</p>
      <p>Your exam is <strong>${ctx.daysToExam ?? 30} days away</strong>. Vidya has activated focused exam preparation mode for you.</p>
      <p>Your revision plan is personalised to the concepts that need the most attention. Consistent daily sessions now will make the biggest difference.</p>
      ${cta('Start Revision', ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/dashboard')}
    `),
    textBody: (ctx) => `Exam in ${ctx.daysToExam ?? 30} days. Start revision: ${ctx.ctaUrl ?? ctx.dashboardUrl}`,
  },

  PARENT_EXAM_COUNTDOWN: {
    id:   'PARENT_EXAM_COUNTDOWN',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_EXAM_COUNTDOWN.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">${ctx.studentName ?? "Your child"}'s exam is in ${ctx.daysToExam ?? 30} days</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>Vidya has activated exam preparation mode for <strong>${ctx.studentName ?? 'your child'}</strong>. The next ${ctx.daysToExam ?? 30} days of focused revision can significantly improve exam readiness.</p>
      <p>Current readiness: <strong>${ctx.examReadinessScore != null ? Math.round(Number(ctx.examReadinessScore) * 100) + '%' : 'Check app'}</strong></p>
      ${cta('View Revision Plan', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `${ctx.studentName}'s exam in ${ctx.daysToExam} days. View plan: ${ctx.dashboardUrl}`,
  },

  STUDENT_REVISION_PLAN_READY: {
    id:   'STUDENT_REVISION_PLAN_READY',
    from: EMAIL_FROM.LEARNING,
    subject: (_ctx) => MAIL_SUBJECTS.STUDENT_PLAN_READY,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">Your revision plan is ready!</h2>
      <p>Hi ${ctx.studentName ?? 'there'},</p>
      <p>Vidya has built a focused revision plan for your upcoming exam. It covers the highest-weightage concepts and your personal weak areas.</p>
      ${ctx.plan ? `<p><strong>Your plan summary:</strong></p><p style="background:#EEEDFE;padding:12px;border-radius:8px;">${ctx.plan}</p>` : ''}
      ${cta('Start Revision', ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/dashboard')}
    `),
    textBody: (ctx) => `Your revision plan is ready. Start here: ${ctx.ctaUrl ?? ctx.dashboardUrl}`,
  },

  PARENT_REVISION_PLAN_READY: {
    id:   'PARENT_REVISION_PLAN_READY',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_REVISION_PLAN.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">${ctx.studentName ?? "Your child"}'s revision plan is ready</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>Vidya has created a structured revision plan for <strong>${ctx.studentName ?? 'your child'}</strong>. The plan is built around:</p>
      <ul>
        <li>High-weightage exam topics</li>
        <li>Personal weak areas identified from practice sessions</li>
        <li>Realistic daily targets that fit alongside school</li>
      </ul>
      ${ctx.plan ? `<p><strong>Plan summary:</strong></p><p style="background:#EEEDFE;padding:12px;border-radius:8px;">${ctx.plan}</p>` : ''}
      ${cta('Review the Plan', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `${ctx.studentName}'s revision plan is ready. View: ${ctx.dashboardUrl}`,
  },

  STUDENT_MOCK_FEEDBACK: {
    id:   'STUDENT_MOCK_FEEDBACK',
    from: EMAIL_FROM.LEARNING,
    subject: (_ctx) => MAIL_SUBJECTS.STUDENT_MOCK_FEEDBACK,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">Your mock test results are in</h2>
      <p>Hi ${ctx.studentName ?? 'there'},</p>
      <p>Great job completing your mock test. Here is what Vidya observed:</p>
      ${ctx.mockStrengths ? `<p><strong>Strengths:</strong> ${ctx.mockStrengths}</p>` : ''}
      ${ctx.mockWeakAreas ? `<p><strong>Areas to focus on:</strong> ${ctx.mockWeakAreas}</p>` : ''}
      <p>Vidya has updated your practice sessions to focus on the areas that will boost your score the most.</p>
      ${cta('Review Detailed Feedback', ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/dashboard')}
    `),
    textBody: (ctx) => `Mock test results ready. Review: ${ctx.ctaUrl ?? ctx.dashboardUrl}`,
  },

  PARENT_MOCK_SUMMARY: {
    id:   'PARENT_MOCK_SUMMARY',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_MOCK_SUMMARY.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">${ctx.studentName ?? "Your child"}'s mock test summary</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p><strong>${ctx.studentName ?? 'Your child'}</strong> completed a full mock test. Here is the summary:</p>
      ${ctx.mockStrengths ? `<p><strong>Strong areas:</strong> ${ctx.mockStrengths}</p>` : ''}
      ${ctx.mockWeakAreas ? `<p><strong>Focus areas:</strong> ${ctx.mockWeakAreas}</p>` : ''}
      <p>Vidya has already prepared targeted practice sessions to address the focus areas.</p>
      ${cta('View Full Report', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `${ctx.studentName}'s mock test summary ready. View: ${ctx.dashboardUrl}`,
  },

  STUDENT_EXAM_RISK_ALERT: {
    id:   'STUDENT_EXAM_RISK_ALERT',
    from: EMAIL_FROM.LEARNING,
    subject: (_ctx) => MAIL_SUBJECTS.STUDENT_EXAM_RISK,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#BA7517;">Focus area detected for your exam</h2>
      <p>Hi ${ctx.studentName ?? 'there'},</p>
      <p>Vidya noticed that <strong>${ctx.concept ?? 'a key topic'}</strong> -- which carries significant weight in your exam -- needs more practice. Your current mastery: <strong>${ctx.masteryScore != null ? ctx.masteryScore + '%' : 'check app'}</strong>.</p>
      <p>2--3 focused sessions on this topic can boost your score meaningfully. Your practice set is ready.</p>
      ${cta('Start Focused Practice', ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/dashboard')}
    `),
    textBody: (ctx) => `Focus area: ${ctx.concept}. Start practice: ${ctx.ctaUrl ?? ctx.dashboardUrl}`,
  },

  PARENT_EXAM_RISK_ALERT: {
    id:   'PARENT_EXAM_RISK_ALERT',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_EXAM_RISK.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#BA7517;">Action recommended: focus area for ${ctx.studentName ?? "your child"}'s exam</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>Vidya detected that <strong>${ctx.concept ?? 'a high-weightage topic'}</strong> needs more attention before ${ctx.studentName ?? "your child"}'s exam.</p>
      <p>A focused practice plan is ready. 2--3 sessions can make a meaningful difference.</p>
      ${cta('View Action Plan', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `Exam focus needed: ${ctx.concept}. View plan: ${ctx.dashboardUrl}`,
  },

  // ── Reporting ───────────────────────────────────────────────────────────────

  PARENT_WEEKLY_REPORT: {
    id:   'PARENT_WEEKLY_REPORT',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_WEEKLY_REPORT
      .replace('{name}', ctx.studentName ?? 'your child')
      .replace('{date}', ctx.weekOf ?? ctx.date ?? ''),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">${ctx.studentName ?? "Your child"}'s weekly learning report</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>Here is ${ctx.studentName ?? "your child"}'s progress for the week of <strong>${ctx.weekOf ?? ctx.date ?? ''}</strong>:</p>

      <h3 style="color:#534AB7;">Consistency</h3>
      <ul>
        <li>Studied <strong>${ctx.studyDays ?? ctx.daysActive ?? 0} out of 7 days</strong></li>
        <li>Total time: <strong>${ctx.totalHours ?? 0} hours</strong></li>
        <li>Streak: <strong>${ctx.streakDays ?? 0} days</strong></li>
      </ul>

      ${ctx.topicName ? `<h3 style="color:#534AB7;">Topics covered</h3><p>${ctx.topicName}</p>` : ''}

      ${ctx.examReadinessScore != null ? `
        <h3 style="color:#534AB7;">Exam readiness</h3>
        <p>Current readiness: <strong>${Math.round(Number(ctx.examReadinessScore) * 100)}%</strong></p>
      ` : ''}

      ${cta('View Full Report', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>Have questions? Reply to this email.</p>
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `Weekly report for ${ctx.studentName}: ${ctx.studyDays ?? ctx.daysActive ?? 0}/7 days, ${ctx.totalHours ?? 0}h. View: ${ctx.dashboardUrl}`,
  },

  PARENT_MONTHLY_REPORT: {
    id:   'PARENT_MONTHLY_REPORT',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_MONTHLY_REPORT
      .replace('{name}', ctx.studentName ?? 'your child')
      .replace('{date}', ctx.date ?? ''),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">${ctx.studentName ?? "Your child"}'s monthly progress report</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>Here is a summary of ${ctx.studentName ?? "your child"}'s learning this month:</p>
      <ul>
        <li>Total study time: <strong>${ctx.totalHours ?? 0} hours</strong></li>
        <li>Days active: <strong>${ctx.daysActive ?? 0}</strong></li>
        <li>Longest streak: <strong>${ctx.streakDays ?? 0} days</strong></li>
      </ul>
      ${ctx.examReadinessScore != null ? `<p>Exam readiness: <strong>${Math.round(Number(ctx.examReadinessScore) * 100)}%</strong></p>` : ''}
      ${cta('View Full Report', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `Monthly report for ${ctx.studentName}. View: ${ctx.dashboardUrl}`,
  },

  // ── Billing ─────────────────────────────────────────────────────────────────

  PARENT_TRIAL_ENDING: {
    id:   'PARENT_TRIAL_ENDING',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_TRIAL_ENDING.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">Continue ${ctx.studentName ?? "your child"}'s learning journey</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>${ctx.studentName ?? "Your child"}'s free trial ends in <strong>3 days</strong>. Continue with a plan for just <strong>Rs.399/month</strong> -- no hidden charges.</p>
      <p>${ctx.studentName ?? "Your child"}'s personalised study plan, streak, and progress will all carry over seamlessly.</p>
      ${cta('Continue Learning', ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/upgrade')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `Trial ending in 3 days. Continue for Rs.399/month: ${ctx.ctaUrl ?? ctx.dashboardUrl}`,
  },

  PARENT_TRIAL_ENDED: {
    id:   'PARENT_TRIAL_ENDED',
    from: EMAIL_FROM.NOREPLY,
    subject: (ctx) => MAIL_SUBJECTS.PARENT_TRIAL_ENDED.replace('{name}', ctx.studentName ?? 'your child'),
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">Keep ${ctx.studentName ?? "your child"}'s learning going</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>${ctx.studentName ?? "Your child"}'s free trial has ended. Their personalised study plan and progress history are safely stored and ready to continue.</p>
      <p>Subscribe now for just <strong>Rs.399/month</strong> to pick up right where they left off.</p>
      ${cta('Subscribe Now', ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/upgrade')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `Trial ended. Subscribe for Rs.399/month to continue: ${ctx.ctaUrl ?? ctx.dashboardUrl}`,
  },

  PARENT_PAYMENT_SUCCESS: {
    id:   'PARENT_PAYMENT_SUCCESS',
    from: EMAIL_FROM.BILLING,
    subject: (_ctx) => MAIL_SUBJECTS.PARENT_PAYMENT_SUCCESS,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#1D9E75;">Payment confirmed</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>Your payment of <strong>${ctx.amount ?? 'Rs.399'}</strong> has been confirmed. Thank you.</p>
      <ul>
        ${ctx.nextBillingDate ? `<li>Next billing date: <strong>${ctx.nextBillingDate}</strong></li>` : ''}
        ${ctx.invoiceUrl ? `<li><a href="${ctx.invoiceUrl}">Download invoice</a></li>` : ''}
      </ul>
      <p>${ctx.studentName ?? "Your child"}'s learning continues uninterrupted.</p>
      ${cta('Open Dashboard', ctx.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard')}
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `Payment confirmed. Next billing: ${ctx.nextBillingDate}. Dashboard: ${ctx.dashboardUrl}`,
  },

  PARENT_PAYMENT_FAILED: {
    id:   'PARENT_PAYMENT_FAILED',
    from: EMAIL_FROM.BILLING,
    subject: (_ctx) => MAIL_SUBJECTS.PARENT_PAYMENT_FAILED,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#E24B4A;">Payment issue -- action needed</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>We were unable to process your recent payment. This can happen due to card expiry, insufficient balance, or a bank block on the transaction.</p>
      <p>Please update your payment method to continue ${ctx.studentName ?? "your child"}'s learning without interruption.</p>
      ${cta('Update Payment Method', ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/billing')}
      <p>If you need help, reply to this email.</p>
      <p>The Vidya Team</p>
    `),
    textBody: (ctx) => `Payment issue. Update payment method: ${ctx.ctaUrl ?? ctx.dashboardUrl}`,
  },

  // ── Security ────────────────────────────────────────────────────────────────

  STUDENT_SECURITY_ALERT: {
    id:   'STUDENT_SECURITY_ALERT',
    from: EMAIL_FROM.NOREPLY,
    subject: (_ctx) => MAIL_SUBJECTS.STUDENT_SECURITY_ALERT,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#E24B4A;">Security notice for your account</h2>
      <p>Hi ${ctx.studentName ?? 'there'},</p>
      <p>We noticed multiple unsuccessful sign-in attempts on your Spinzy Academy account. If this was not you, your account is still secure -- but please change your password as a precaution.</p>
      ${ctx.ipAddress ? `<p>Attempted from: ${ctx.ipAddress}</p>` : ''}
      ${cta('Secure My Account', ctx.ctaUrl ?? 'https://spinzyacademy.com/settings')}
      <p>If you did try to sign in, you can ignore this message.</p>
    `),
    textBody: (_ctx) => `Security notice: multiple failed login attempts. Secure your account at https://spinzyacademy.com/settings`,
  },

  PARENT_SECURITY_ALERT: {
    id:   'PARENT_SECURITY_ALERT',
    from: EMAIL_FROM.NOREPLY,
    subject: (_ctx) => MAIL_SUBJECTS.PARENT_SECURITY_ALERT,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#E24B4A;">Security notice for your Spinzy account</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>We noticed multiple unsuccessful sign-in attempts on the Spinzy Academy account linked to <strong>${ctx.studentName ?? 'your child'}</strong>. The account is still secure.</p>
      <p>If this was unexpected, please contact our support team.</p>
      ${cta('Contact Support', `mailto:support@spinzyacademy.com`)}
      <p>The Vidya Team</p>
    `),
    textBody: (_ctx) => `Security notice: multiple failed login attempts. Contact support@spinzyacademy.com`,
  },

  STUDENT_NEW_DEVICE_LOGIN: {
    id:   'STUDENT_NEW_DEVICE_LOGIN',
    from: EMAIL_FROM.NOREPLY,
    subject: (_ctx) => MAIL_SUBJECTS.STUDENT_NEW_DEVICE,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">New sign-in to your Spinzy account</h2>
      <p>Hi ${ctx.studentName ?? 'there'},</p>
      <p>Your Spinzy Academy account was signed into from a new device${ctx.deviceInfo ? ` (${ctx.deviceInfo})` : ''}.</p>
      <p>If this was you, no action is needed. If not, please contact us immediately.</p>
      ${cta('Review Account Security', ctx.ctaUrl ?? 'https://spinzyacademy.com/settings')}
    `),
    textBody: (_ctx) => `New sign-in detected. Review your account: https://spinzyacademy.com/settings`,
  },

  PARENT_NEW_DEVICE_LOGIN: {
    id:   'PARENT_NEW_DEVICE_LOGIN',
    from: EMAIL_FROM.NOREPLY,
    subject: (_ctx) => MAIL_SUBJECTS.PARENT_NEW_DEVICE,
    htmlBody: (ctx) => buildHtml(`
      <h2 style="color:#534AB7;">New sign-in to your Spinzy account</h2>
      <p>Hi ${ctx.parentName ?? 'there'},</p>
      <p>Your Spinzy Academy account was signed into from a new device${ctx.deviceInfo ? ` (${ctx.deviceInfo})` : ''}. This is just a heads-up.</p>
      <p>If this was you, no action is needed.</p>
      ${cta('Review Account', ctx.ctaUrl ?? 'https://spinzyacademy.com/parent/settings')}
    `),
    textBody: (_ctx) => `New sign-in detected on your parent account. Review: https://spinzyacademy.com/parent/settings`,
  },

} as const satisfies Record<string, EmailTemplate>;

// ── Send functions ────────────────────────────────────────────────────────────

/**
 * Send a single email using a named template from EMAIL_TEMPLATES.
 *
 * @param templateId - Key from EMAIL_TEMPLATES catalog
 * @param to - Recipient email address
 * @param context - Template interpolation context
 * @param options - Optional send options (priority, delay)
 * @returns SendEmailResult with success flag and optional messageId/error
 */
export async function sendEmail(
  templateId: string,
  to: string,
  context: EmailTemplateContext,
  _options?: SendEmailOptions,
): Promise<SendEmailResult> {
  const template = EMAIL_TEMPLATES[templateId];
  if (!template) {
    logger.warn('[mail] unknown templateId', { templateId });
    return { success: false, error: `Unknown template: ${templateId}` };
  }

  try {
    const subject = template.subject(context);
    const html    = template.htmlBody(context);
    const text    = template.textBody(context);

    await sendMailSafe({ to, subject, html, text });

    logger.info('[mail] sent', { templateId, to: to.slice(0, 3) + '***' });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[mail] send failed', { templateId, error: message });
    return { success: false, error: message };
  }
}

/**
 * Send a batch of templated emails. Failures are logged individually; batch continues.
 *
 * @param emails - Array of { templateId, to, context } objects
 * @returns Aggregate sent/failed counts
 */
export async function sendEmailBatch(
  emails: Array<{ templateId: string; to: string; context: EmailTemplateContext }>,
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    emails.map(({ templateId, to, context }) => sendEmail(templateId, to, context)),
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

  logger.info('[mail] batch complete', { total: emails.length, sent, failed });
  return { sent, failed };
}
