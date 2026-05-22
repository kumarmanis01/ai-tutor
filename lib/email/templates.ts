/**
 * FILE OBJECTIVE:
 * - Centralised HTML email templates used across workers, API routes and UI
 *   to ensure consistent branding, footer and support address usage.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/templates.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-14T00:00:00Z | copilot | add standard file header and document support-email centralisation
 * - 2026-05-17T00:00:00Z | reviewer | replace numeric accuracy/mastery values with qualitative labels
 *   in sessionCompleteForParentHtml to comply with no-numeric-score product rule
 */

// CONSOLIDATION PENDING: the following call sites bypass sendEmailUnified and call template
// functions directly. Each is marked with a TODO(email-consolidation) comment at the call site.
// Migrate each to the EMAIL_TEMPLATES catalog in lib/mail.ts as a follow-up task.
//
//   app/api/auth/signup/route.ts                                  welcomeEmailHtml
//   app/api/user/onboarding/route.ts                              welcomeEmailHtml
//   app/api/auth/parent/send-otp/route.ts                         parentOtpHtml
//   app/api/enroll/send-parent-otp/route.ts                       parentOtpHtml
//   app/api/student/verify-parent/send-otp/route.ts               parentOtpHtml
//   app/api/parent/create-child/route.ts                          parentWelcomeHtml
//   app/api/parent/link-child/route.ts                            parentWelcomeHtml
//   app/api/parent/link/route.ts                                  parentWelcomeHtml
//   app/api/parent/subscription/verify/route.ts                   paymentReceiptHtml
//   app/api/billing/verify/route.ts                               paymentReceiptHtml
//   app/api/payments/verify-subscription/route.ts                 paymentReceiptHtml
//   app/api/student/subscription/verify/route.ts                  paymentReceiptHtml (x2)
//   app/api/mock/attempt/[attemptId]/complete/route.ts            milestoneEmailHtml
//   app/api/admin/test-email/route.ts                             welcomeEmailHtml, magicLinkHtml, paymentReceiptHtml, parentOtpHtml
//   app/api/admin/notifications/broadcast/route.ts                adminBroadcastEmailHtml
//   app/api/admin/notifications/broadcast-digest/route.ts         weeklyDigestHtml
//   app/api/admin/notifications/send/route.ts                     adminBroadcastEmailHtml
//   app/api/admin/notifications/trigger-pending-diagnostics/route.ts adminBroadcastEmailHtml
//   app/api/session/[sessionId]/practice/hydrate/route.ts         adminBroadcastEmailHtml
//   app/api/student/account/deletion-request/route.ts             deletionConfirmHtml
//   lib/auth.ts                                                   welcomeEmailHtml, magicLinkHtml
//   lib/contentJobAlerts.ts                                       contentJobFailureAlertHtml
//   lib/notifications/parentNotify.ts                             diagnosticCompleteForParentHtml, planGeneratedForParentHtml, sessionCompleteForParentHtml, inactivityNudgeHtml
//   lib/notifications/studentNotify.ts                            sessionCompleteForStudentHtml
//   lib/student/xp.ts                                             milestoneEmailHtml
//   lib/student/badges.ts                                         milestoneEmailHtml
//   worker/jobs/dailyLatencyReport.ts                             adminBroadcastEmailHtml
//   worker/jobs/dailyQuestionGenMetrics.ts                        adminBroadcastEmailHtml
//   worker/jobs/diagnosticReadinessCheck.ts                       diagnosticReadyEmailHtml
//   worker/jobs/inactivityAlert.ts                                inactivityNudgeHtml
//   worker/jobs/parentEmailDigest.ts                              parentDigestHtml (x2)
//   worker/jobs/weeklyRatingAggregation.ts                        adminBroadcastEmailHtml
//   worker/services/costReportingWorker.ts                        costAnomalyHtml
//   worker/services/distressNotificationWorker.ts                 distressNotificationParentHtml
//   worker/services/doubtEscalationNotifier.ts                    adminBroadcastEmailHtml
//   worker/services/hydrationReconciler.ts                        hydrationGenerationReportHtml
//   worker/services/installmentDunningWorker.ts                   paymentReceiptHtml, graceStartedHtml
//   worker/services/paymentDunningWorker.ts                       paymentReceiptHtml (x2), paymentRetryReminderHtml (x2), graceStartedHtml, subscriptionExpiredHtml
//   worker/services/readinessDropWorker.ts                        adminBroadcastEmailHtml
//   worker/services/subscriptionRenewalWorker.ts                  paymentRetryReminderHtml (x2), graceStartedHtml
//   worker/services/weeklyDigestWorker.ts                         weeklyDigestParentHtml

import { TEMPLATES_LEGACY_SUPPORT_EMAIL } from '@/lib/email/functionalityEmails';
import { BASE, BTN, FOOTER, LOGO } from '@/lib/email/layout'

// ── Shared primitives ─────────────────────────────────────────────────────────

// Shared primitives (imported from lib/email/layout.ts)

// ── Template exports ──────────────────────────────────────────────────────────

export function welcomeEmailHtml(name: string): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Welcome to Spinzy Academy, ${name}!</h2>
      <p>Teacher Vidya is ready to personalise your learning journey.</p>
      <p>Complete your diagnostic test so Vidya can understand where you are
         and what to focus on next.</p>
      <a href="https://spinzyacademy.com/dashboard" style="${BTN}">
        Start learning
      </a>
      ${FOOTER}
    </div>
  `;
}

export function magicLinkHtml(url: string): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Sign in to Spinzy Academy</h2>
      <p>Click the button below to sign in.
         This link expires in 24 hours.</p>
      <a href="${url}" style="${BTN}">Sign in</a>
      <p style="color:#888;font-size:13px;margin-top:16px;">
        Or copy this link: ${url}
      </p>
      <p style="color:#888;font-size:13px;">
        If you did not request this, ignore it safely.
      </p>
      ${FOOTER}
    </div>
  `;
}

export function parentOtpHtml(otp: string, studentName: string): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Parent verification required</h2>
      <p>${studentName} has signed up for Spinzy Academy
         and needs your approval to activate their account.</p>
      <p style="font-size:36px;font-weight:700;letter-spacing:10px;
                color:#534AB7;text-align:center;padding:20px 0;
                background:#EEEDFE;border-radius:12px;margin:20px 0;">
        ${otp}
      </p>
      <p>Enter this code in the Spinzy app to activate ${studentName}'s account.</p>
      <p style="color:#888;font-size:13px;">
        This code expires in 10 minutes.
        If you were not expecting this, ignore this email safely.
      </p>
      ${FOOTER}
    </div>
  `;
}

export function parentWelcomeHtml(parentName: string | null, studentName: string): string {
  const displayName = parentName ? parentName : `Parent of ${studentName}`;
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Welcome -- your parent account is confirmed</h2>
      <p>Hi ${displayName},</p>
      <p>Thanks for verifying your parent access for <strong>${studentName}</strong>. You can now:
      </p>
      <ul style="line-height:1.6;color:#374151;">
        <li>View weekly learning reports and session summaries for ${studentName}.</li>
        <li>See readiness scores, streaks, and topic-wise progress.</li>
        <li>Receive optional weekly digests and inactivity alerts (configurable in your parent settings).</li>
      </ul>

      <h3 style="color:#534AB7;font-size:16px;margin-top:18px;">Privacy summary</h3>
      <p style="color:#374151;line-height:1.6;">
        We collect and store learning analytics (sessions, answers, progress scores) to personalise instruction and show progress. We do not share personal data with third parties except vendors required to operate the service. Raw session transcripts used for model evaluation are pseudonymised and access-restricted. You can request data export or deletion by contacting ${TEMPLATES_LEGACY_SUPPORT_EMAIL}.
      </p>

      <a href="https://spinzyacademy.com/parent/dashboard" style="${BTN}">Open parent dashboard</a>

      <p style="color:#888;font-size:13px;margin-top:16px;">
        Questions? Reply to this email or reach us at ${TEMPLATES_LEGACY_SUPPORT_EMAIL}
      </p>
      ${FOOTER}
    </div>
  `;
}

export function paymentReceiptHtml(data: {
  studentName: string;
  plan: string;
  amountRupees: number;
  billingCycle: string;
  renewalDate: string;
}): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Payment confirmed</h2>
      <div style="background:#F0FDF4;border:1px solid #86EFAC;
                  border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#166534;font-weight:600;">
          Your subscription is now active
        </p>
      </div>
      <table width="100%" cellpadding="8"
             style="border-top:1px solid #eee;font-size:14px;">
        <tr>
          <td style="color:#666;">Student</td>
          <td style="text-align:right;">${data.studentName}</td>
        </tr>
        <tr>
          <td style="color:#666;">Plan</td>
          <td style="text-align:right;">${data.plan} (${data.billingCycle})</td>
        </tr>
        <tr>
          <td style="color:#666;">Amount paid</td>
          <td style="text-align:right;font-weight:600;">
            &#8377;${data.amountRupees}
          </td>
        </tr>
        <tr>
          <td style="color:#666;">Renews on</td>
          <td style="text-align:right;">${data.renewalDate}</td>
        </tr>
      </table>
      <p style="color:#888;font-size:13px;margin-top:16px;">
        Questions? Reply to this email or reach us at ${TEMPLATES_LEGACY_SUPPORT_EMAIL}
      </p>
      ${FOOTER}
    </div>
  `;
}

export function weeklyDigestHtml(data: {
  studentName: string;
  sessionsThisWeek: number;
  weeklyGoal: number;
  readinessScore: number;
  topSubject: string;
  streakDays: number;
  parentName?: string;
  dashboardUrl?: string;
}): string {
  const readinessColour =
    data.readinessScore >= 70
      ? '#1D9E75'
      : data.readinessScore >= 40
      ? '#BA7517'
      : '#E24B4A';
  const url = data.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard';
  const heading = data.parentName
    ? `${data.studentName}'s weekly learning report`
    : 'Your weekly learning report';

  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">${heading}</h2>
      <div style="background:#F5F4FF;border-radius:12px;padding:20px;margin:20px 0;">
        <table width="100%" cellpadding="8" style="font-size:14px;">
          <tr>
            <td>Sessions this week</td>
            <td style="text-align:right;font-weight:600;">
              ${data.sessionsThisWeek} / ${data.weeklyGoal}
            </td>
          </tr>
          <tr>
            <td>Overall readiness</td>
            <td style="text-align:right;font-weight:600;color:${readinessColour};">
              ${data.readinessScore}%
            </td>
          </tr>
          <tr>
            <td>Current streak</td>
            <td style="text-align:right;font-weight:600;">
              ${data.streakDays} day${data.streakDays !== 1 ? 's' : ''}
            </td>
          </tr>
          <tr>
            <td>Top subject</td>
            <td style="text-align:right;font-weight:600;">${data.topSubject}</td>
          </tr>
        </table>
      </div>
      <a href="${url}" style="${BTN}">
        ${data.parentName ? 'View full report' : 'Continue learning'}
      </a>
      ${FOOTER}
    </div>
  `;
}

export function distressAlertHtml(data: {
  studentName: string;
  severity: string;
  sessionId: string;
  message: string;
}): string {
  return `
    <div style="${BASE}">
      <div style="background:#FEE2E2;border:1px solid #EF4444;
                  border-radius:8px;padding:16px;margin-bottom:24px;">
        <strong style="color:#DC2626;">
          ALERT: Student distress detected [${data.severity}]
        </strong>
      </div>
      <p><strong>Student:</strong> ${data.studentName}</p>
      <p><strong>Severity:</strong> ${data.severity}</p>
      <p><strong>Session:</strong> ${data.sessionId}</p>
      <p><strong>Message excerpt:</strong></p>
      <blockquote style="border-left:3px solid #EF4444;
                          padding-left:12px;color:#666;">
        ${data.message}
      </blockquote>
      <a href="https://spinzyacademy.com/admin/sessions" style="${BTN}">
        Review session
      </a>
      ${FOOTER}
    </div>
  `;
}

export function costAnomalyHtml(data: {
  dateLabel: string;
  sessions: number;
  totalCostUsd: number;
  costPerSession: number;
  multiplier?: number;
  trendingDoubts?: Array<{ conceptName: string; studentCount: number }>;
}): string {
  const trendingSection = data.trendingDoubts && data.trendingDoubts.length
    ? `
      <h3 style="color:#534AB7;margin-top:16px;">Trending doubts (last 7 days)</h3>
      <ul style="color:#374151;line-height:1.6;margin-top:6px;">
        ${data.trendingDoubts.map(d => `<li>${d.conceptName}: ${d.studentCount} escalations</li>`).join('')}
      </ul>
    `
    : '';

  return `
    <div style="${BASE}">
      <div style="background:#FEF3C7;border:1px solid #F59E0B;
                  border-radius:8px;padding:16px;margin-bottom:24px;">
        <strong style="color:#B45309;">
          Cost alert${data.multiplier ? ` -- ${data.multiplier}x above average` : ''}
        </strong>
      </div>
      <p><strong>Date:</strong> ${data.dateLabel}</p>
      <p><strong>Sessions:</strong> ${data.sessions}</p>
      <p><strong>Total cost:</strong> $${data.totalCostUsd.toFixed(4)}</p>
      <p><strong>Cost per session:</strong> $${data.costPerSession.toFixed(5)}</p>
      ${trendingSection}
      <a href="https://spinzyacademy.com/admin/costs" style="${BTN}">
        View costs
      </a>
      ${FOOTER}
    </div>
  `;
}

/**
 * Admin-facing topic ranker coverage alert HTML.
 */
export function topicRankerCoverageAlertHtml(params: {
  studentId: string
  frontierSize: number
  rankableFrontierSize: number
  filteredTopicIds: string[]
}): string {
  const { studentId, frontierSize, rankableFrontierSize, filteredTopicIds } = params
  const filtered = Array.from(new Set(filteredTopicIds)).filter(Boolean)
  const sampled = filtered.slice(0, 20)
  const extra = Math.max(0, filtered.length - sampled.length)

  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Topic ranker coverage alert</h2>
      <p>No active concepts were available for some frontier topics.</p>
      <ul>
        <li><strong>Student ID:</strong> ${studentId}</li>
        <li><strong>Frontier size:</strong> ${frontierSize}</li>
        <li><strong>Rankable frontier size:</strong> ${rankableFrontierSize}</li>
        <li><strong>Filtered topic count:</strong> ${filtered.length}</li>
      </ul>
      <h4>Sample filtered topic IDs</h4>
      <ul>
        ${sampled.map((t) => `<li>${t}</li>`).join('')}
      </ul>
      ${extra > 0 ? `<p>...and ${extra} more</p>` : ''}
      ${FOOTER}
    </div>
  `
}

export function contentJobFailureAlertHtml(data: {
  hydrationJobId: string;
  lastError: string;
  subject: string;
  grade: number;
  board: string;
  adminUrl: string;
  willRetryAt?: Date;
}): string {
  const isRetrying = data.willRetryAt !== undefined;
  const retryLabel = isRetrying
    ? data.willRetryAt!.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null;
  const headerBg = isRetrying ? '#FEF3C7' : '#FEE2E2';
  const headerBorder = isRetrying ? '#F59E0B' : '#EF4444';
  const headerColor = isRetrying ? '#B45309' : '#DC2626';
  const headerText = isRetrying
    ? `Content generation needs attention -- will retry at ${retryLabel}`
    : 'Content generation needs attention -- action required';

  return `
    <div style="${BASE}">
      <div style="background:${headerBg};border:1px solid ${headerBorder};
                  border-radius:8px;padding:16px;margin-bottom:24px;">
        <strong style="color:${headerColor};">${headerText}</strong>
      </div>
      <table width="100%" cellpadding="6" style="font-size:14px;border-top:1px solid #eee;">
        <tr>
          <td style="color:#666;width:120px;">Subject</td>
          <td style="font-weight:600;">${data.subject}</td>
        </tr>
        <tr>
          <td style="color:#666;">Grade / Board</td>
          <td>Grade ${data.grade} -- ${data.board}</td>
        </tr>
        <tr>
          <td style="color:#666;">Job ID</td>
          <td style="font-family:monospace;font-size:12px;">${data.hydrationJobId}</td>
        </tr>
        <tr>
          <td style="color:#666;">Error</td>
          <td style="font-family:monospace;font-size:12px;color:#DC2626;">${data.lastError}</td>
        </tr>
        ${isRetrying ? `
        <tr>
          <td style="color:#666;">Auto-retry at</td>
          <td style="font-weight:600;color:#B45309;">${retryLabel}</td>
        </tr>` : `
        <tr>
          <td style="color:#666;">Status</td>
          <td style="font-weight:600;color:#DC2626;">Auto-retries exhausted -- manual review needed</td>
        </tr>`}
      </table>
      <div style="margin-top:24px;">
        <a href="${data.adminUrl}" style="${BTN}">
          ${isRetrying ? 'View job in admin' : 'Review and restart job'}
        </a>
      </div>
      ${FOOTER}
    </div>
  `;
}

export function hydrationGenerationReportHtml(data: {
  rootJobId: string;
  subject: string;
  statusLabel: string;
  chapters: number;
  topics: number;
  notes: number;
  questions: number;
  llmCalls: number;
  tokensUsed: number;
  failedChildren: number;
}): { html: string; text: string } {
  const { rootJobId, subject, statusLabel, chapters, topics, notes, questions, llmCalls, tokensUsed, failedChildren } = data
  const text = [
    `Hydration generation report`,
    `Root job: ${rootJobId}`,
    `Subject: ${subject}`,
    `Status: ${statusLabel}`,
    '',
    `Content counts:`,
    `  Chapters: ${chapters}`,
    `  Topics:   ${topics}`,
    `  Notes:    ${notes}`,
    `  Questions: ${questions}`,
    '',
    `LLM usage:`,
    `  Calls:  ${llmCalls}`,
    `  Tokens: ${tokensUsed}`,
    '',
    failedChildren > 0 ? `FAILURES: ${failedChildren} child jobs failed -- check PM2 logs for rootJobId ${rootJobId}` : 'No failures.',
  ].join('\n')

  const html = `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Hydration generation report</h2>
      <p><strong>Root job:</strong> ${rootJobId}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Status:</strong> ${statusLabel}</p>
      <table width="100%" cellpadding="6" style="font-size:14px;border-top:1px solid #eee;margin-top:8px;">
        <tr><td style="color:#666;">Chapters</td><td style="text-align:right;font-weight:600;">${chapters}</td></tr>
        <tr><td style="color:#666;">Topics</td><td style="text-align:right;font-weight:600;">${topics}</td></tr>
        <tr><td style="color:#666;">Notes</td><td style="text-align:right;font-weight:600;">${notes}</td></tr>
        <tr><td style="color:#666;">Questions</td><td style="text-align:right;font-weight:600;">${questions}</td></tr>
      </table>
      <p style="margin-top:12px;"><strong>LLM usage:</strong> ${llmCalls} calls, ${tokensUsed} tokens</p>
      ${failedChildren > 0 ? `<p style="color:#DC2626;font-weight:600;">FAILURES: ${failedChildren} child jobs failed</p>` : `<p>No failures.</p>`}
      ${FOOTER}
    </div>
  `

  return { html, text }
}

export function diagnosticReadyEmailHtml(data: {
  studentName: string;
  subjectName: string;
  diagnosticUrl: string;
}): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Your ${data.subjectName} diagnostic is ready!</h2>
      <p>Hi ${data.studentName},</p>
      <p>
        Teacher Vidya has finished preparing your ${data.subjectName} diagnostic.
        It takes about 15 minutes and helps Vidya build a personalised learning plan just for you.
      </p>
      <a href="${data.diagnosticUrl}" style="${BTN}">
        Start diagnostic now
      </a>
      <p style="color:#888;font-size:13px;margin-top:16px;">
        Questions? Reply to this email or reach us at ${TEMPLATES_LEGACY_SUPPORT_EMAIL}
      </p>
      ${FOOTER}
    </div>
  `;
}

/**
 * Parent-facing distress notification HTML (moved from inline worker templates)
 */
export function distressNotificationParentHtml(params: { childName: string; severity: string }): string {
  const { childName, severity: _severity } = params
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">A note about ${childName}</h2>
      <p>Hi,</p>

      <p>During a recent learning session, ${childName} expressed feelings that suggest they may be going through a difficult time. We wanted to let you know so you can check in with them.</p>

      <p>You know your child best. A gentle conversation -- even just asking how they're feeling today -- can make a big difference.</p>

      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 8px;font-weight:600;color:#166534;">Support resources (India):</p>
        <p style="margin:4px 0;color:#15803D;">📞 iCall: <strong>9152987821</strong></p>
        <p style="margin:4px 0;color:#15803D;">📞 Vandrevala Foundation: <strong>1860-2662-345</strong> (24x7)</p>
        <p style="margin:4px 0;font-size:12px;color:#6B7280;">Both are free, confidential, and available in multiple Indian languages.</p>
      </div>

      <p>If you have any concerns or would like to speak with our team, please reply to this email.</p>

      <p style="color:#6B7280;font-size:11px;margin-top:24px;">This message was sent by Spinzy's automated wellbeing monitoring system. Student messages are not shared verbatim to protect privacy.</p>
      ${FOOTER}
    </div>`
}

/**
 * Weekly digest wrapper used by the weekly digest worker (parent-facing).
 * Accepts the same compact params used in the original worker-local builder.
 */
export function weeklyDigestParentHtml(params: {
  parentName: string
  childName: string
  sessionsThisWeek: number
  streak: number
  readinessDelta: number | null
  narrative: string
  dashboardUrl: string
}): string {
  const { parentName, childName, sessionsThisWeek, streak, readinessDelta, narrative, dashboardUrl } = params
  const deltaLine =
    readinessDelta !== null && readinessDelta > 0.05
      ? `<p style="color:#16A34A;margin:4px 0;">📈 Mastery improving this week</p>`
      : readinessDelta !== null && readinessDelta < -0.05
      ? `<p style="color:#DC2626;margin:4px 0;">📉 A few concepts need more practice</p>`
      : ''

  // Wrap the existing content in the shared header/footer for consistency across channels.
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Weekly learning update</h2>
      <p>Hi ${parentName},</p>

      <div style="background:#F9FAFB;border-radius:12px;padding:14px;margin:12px 0;border:1px solid rgba(0,0,0,0.06);">
        <h3 style="margin:0 0 10px;font-size:16px;color:#111;">${childName}</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <div style="flex:1;text-align:center;padding:8px;border-radius:8px;background:rgba(79,70,229,0.06);">
            <div style="font-size:20px;font-weight:700;color:#4F46E5;">${sessionsThisWeek}</div>
            <div style="color:#6B7280;font-size:12px;">Sessions this week</div>
          </div>
          <div style="flex:1;text-align:center;padding:8px;border-radius:8px;background:rgba(217,119,6,0.06);">
            <div style="font-size:20px;font-weight:700;color:#D97706;">${streak}</div>
            <div style="color:#6B7280;font-size:12px;">Day streak</div>
          </div>
        </div>

        ${deltaLine}

        ${narrative ? `<div style="margin-top:12px;padding:12px;border-radius:8px;border-left:3px solid ${readinessDelta !== null && readinessDelta > 0.05 ? '#16A34A' : '#D1FAE5'};"><p style="margin:0;color:#111;">${narrative}</p></div>` : ''}
      </div>

      <div style="text-align:center;margin-top:14px;">
        <a href="${dashboardUrl}" style="${BTN}">View full progress →</a>
      </div>

      ${FOOTER}
    </div>
  `
}

/**
 * Parent digest HTML wrapper used in the parent email digest job.
 * Accepts prepared child section HTML fragments and composes the full digest.
 */
export function parentDigestHtml(parentName: string, childSections: string[]): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <style>
        body { margin:0; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
        a { color: #4F46E5; }
      </style>
    </head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#0f172a;background:#ffffff;">
      <div style="text-align:center;margin-bottom:24px;">
        ${LOGO}
        <p style="color:#6B7280;margin:8px 0 0;">Weekly Learning Summary</p>
      </div>

      <p style="margin:0 0 8px 0;">Hi ${parentName},</p>
      <p style="margin:0 0 16px 0;">Here's how learning went this week:</p>

      ${childSections.join('')}

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E5E7EB;text-align:center;">
        <a href="${process.env.NEXTAUTH_URL || 'https://spinzyacademy.com'}/parent" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">View Full Dashboard</a>
      </div>

      <p style="color:#6B7280;font-size:12px;text-align:center;margin-top:24px;">
        You're receiving this because you have linked student accounts on Spinzy Academy.
      </p>
    </body>
    </html>
  `
}

export function qaTestHtml(message: string): string {
  return `<!doctype html><html><body><h2>QA Digest Render Test</h2><p>${message}</p></body></html>`
}

export function deletionConfirmHtml(): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Account deletion requested</h2>
      <p>We have received your request to delete your Spinzy Academy account.</p>
      <ul style="color:#374151;line-height:1.8;">
        <li>Your account is now deactivated.</li>
        <li>Personal data will be anonymised within 7 days.</li>
        <li>All data will be permanently deleted within 30 days.</li>
      </ul>
      <p style="color:#888;font-size:13px;">
        Learning analytics may be retained in anonymised form as required by law.
        If you change your mind, contact ${TEMPLATES_LEGACY_SUPPORT_EMAIL} within 7 days.
      </p>
      ${FOOTER}
    </div>
  `;
}

/**
 * Inactivity nudge to parent: student has not studied in N days.
 * Copy rules: no "missed"; forward-looking tone.
 */
export function inactivityNudgeHtml(data: {
  parentName: string;
  studentName: string;
  inactiveDays: number;
  lastStudiedLabel: string;
  dashboardUrl?: string;
}): string {
  const url = data.dashboardUrl ?? 'https://spinzyacademy.com/dashboard';
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Time to get back to learning, ${data.studentName}!</h2>
      <p>Hi ${data.parentName},</p>
      <p>It has been <strong>${data.inactiveDays} day${data.inactiveDays !== 1 ? 's' : ''}</strong> since
         ${data.studentName} last had a study session${data.lastStudiedLabel ? ` (last active: ${data.lastStudiedLabel})` : ''}.
         A short 10-minute session today is all it takes to build the habit back.</p>

      <div style="background:#EEEDFE;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0 0 8px;color:#534AB7;font-weight:600;font-size:15px;">
          Even 10 minutes counts.
        </p>
        <p style="margin:0;color:#666;font-size:13px;">
          Teacher Vidya has a personalised lesson waiting.
        </p>
      </div>

      <a href="${url}" style="${BTN}">Resume learning now</a>

      <p style="color:#888;font-size:13px;margin-top:16px;">
        You can turn off these reminders from your parent dashboard settings.
      </p>
      ${FOOTER}
    </div>
  `;
}

/**
 * Milestone notification to parent: student achieved something worth celebrating.
 */
export function milestoneEmailHtml(data: {
  parentName: string;
  studentName: string;
  milestoneLabel: string;
  milestoneDetail?: string;
  dashboardUrl?: string;
}): string {
  const url = data.dashboardUrl ?? 'https://spinzyacademy.com/parent/dashboard';
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">${data.studentName} just hit a new milestone!</h2>
      <p>Hi ${data.parentName},</p>

      <div style="background:#EAF3DE;border:1px solid #A7D7A1;border-radius:12px;
                  padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0 0 6px;font-size:32px;">&#127881;</p>
        <p style="margin:0;color:#166534;font-weight:700;font-size:17px;">
          ${data.milestoneLabel}
        </p>
        ${data.milestoneDetail ? `
        <p style="margin:8px 0 0;color:#4B7A45;font-size:13px;">${data.milestoneDetail}</p>
        ` : ''}
      </div>

      <p>Every milestone is a step closer to exam confidence. Keep encouraging
         ${data.studentName} to study a little every day -- consistency is the key.</p>

      <a href="${url}" style="${BTN}">View progress</a>

      ${FOOTER}
    </div>
  `;
}

/**
 * Admin-composed broadcast email -- wraps free-form admin message in brand template.
 * Used when admin sends a custom message via the notification composer.
 */
export function adminBroadcastEmailHtml(data: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const cta = data.ctaUrl ? `
    <div style="margin:24px 0;">
      <a href="${data.ctaUrl}" style="${BTN}">${data.ctaLabel ?? 'Open Spinzy'}</a>
    </div>
  ` : '';
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">${data.title}</h2>
      <div style="color:#374151;line-height:1.7;white-space:pre-wrap;">${data.body}</div>
      ${cta}
      ${FOOTER}
    </div>
  `;
}

// -----------------------------------------------------------------------------
// Additional templates added to cover ad-hoc cases discovered in the audit.
// These are intentionally simple and reuse the shared primitives (LOGO, BTN, FOOTER).
// -----------------------------------------------------------------------------

export function referralVoidedHtml(data: { name?: string; code: string }): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Referral attempt voided</h2>
      <p>Hi ${data.name ?? 'there'},</p>
      <p>Your referral attempt using code <strong>${data.code}</strong> was marked void due to suspected abuse (same device or network). No reward will be issued for this referral.</p>
      <p>If you believe this is a mistake, reply to this email or contact support for help.</p>
      ${FOOTER}
    </div>
  `;
}

export function parentPaymentFailedHtml(data: { name?: string; retryUrl: string; supportEmail?: string }): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#E24B4A;">Payment couldn't be completed</h2>
      <p>Hi ${data.name ?? 'Parent'},</p>
      <p>We attempted to process your recent payment but it failed. Please update your payment method and retry using the button below.</p>
      <a href="${data.retryUrl}" style="${BTN}">Update payment & retry</a>
      <p style="color:#888;font-size:13px;margin-top:12px;">If you need help, contact ${data.supportEmail ?? TEMPLATES_LEGACY_SUPPORT_EMAIL}.</p>
      ${FOOTER}
    </div>
  `;
}

export function paymentRetryReminderHtml(data: { name?: string; retryUrl: string }): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#BA7517;">Payment retry reminder</h2>
      <p>Hi ${data.name ?? 'Parent'},</p>
      <p>We attempted to renew your Spinzy subscription but couldn't complete the payment. Please update your payment method and retry to avoid interruption.</p>
      <a href="${data.retryUrl}" style="${BTN}">Update payment</a>
      ${FOOTER}
    </div>
  `;
}

export function graceStartedHtml(data: { name?: string; untilLabel: string; billingUrl: string }): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#BA7517;">Grace period started</h2>
      <p>Hi ${data.name ?? 'Parent'},</p>
      <p>We've started a 3-day grace period until <strong>${data.untilLabel}</strong>. Your children will keep access during this window. Please update payment to avoid service interruption.</p>
      <a href="${data.billingUrl}" style="${BTN}">Update payment</a>
      ${FOOTER}
    </div>
  `;
}

export function subscriptionExpiredHtml(data: { name?: string; renewUrl: string }): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#E24B4A;">Subscription expired</h2>
      <p>Hi ${data.name ?? 'Parent'},</p>
      <p>Your Spinzy subscription has expired because payment could not be completed. You can renew using the button below.</p>
      <a href="${data.renewUrl}" style="${BTN}">Renew subscription</a>
      ${FOOTER}
    </div>
  `;
}

/**
 * Trial ending reminder to student/parent.
 */
export function trialEndingHtml(data: {
  name: string;
  daysLeft: number;
  upgradeUrl: string;
}): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Your trial ends in ${data.daysLeft} day${data.daysLeft !== 1 ? 's' : ''}</h2>
      <p>Hi ${data.name},</p>
      <p>Your free trial is almost over -- but your learning journey is just getting started.
         Continue with a full Spinzy Academy subscription for just <strong>&#8377;399/month</strong>.</p>

      <div style="background:#EEEDFE;border-radius:12px;padding:16px 20px;margin:20px 0;">
        <table width="100%" cellpadding="6" style="font-size:14px;">
          <tr>
            <td style="color:#534AB7;">Subscription</td>
            <td style="text-align:right;font-weight:600;color:#534AB7;">&#8377;399 / month</td>
          </tr>
          <tr>
            <td style="color:#666;font-size:13px;">Unlimited AI sessions with Teacher Vidya</td>
            <td></td>
          </tr>
        </table>
      </div>

      <a href="${data.upgradeUrl}" style="${BTN}">Upgrade now</a>

      <p style="color:#888;font-size:13px;margin-top:16px;">
        No hidden charges. Cancel any time.
      </p>
      ${FOOTER}
    </div>
  `;
}

export function diagnosticCompleteForParentHtml(data: {
  parentName: string;
  studentName: string;
  subjectName: string;
  placement: string;
  dashboardUrl: string;
}): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#534AB7;">Diagnostic complete for ${data.studentName}</h2>
      <p>Hi ${data.parentName},</p>
      <p>${data.studentName} has completed their ${data.subjectName} diagnostic on Spinzy Academy.
         Based on their responses, we have identified their current level and created a
         personalised learning path.</p>

      <div style="background:#EEEDFE;border-radius:12px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#534AB7;font-weight:600;">
          Current placement: ${data.placement}
        </p>
        <p style="margin:8px 0 0;font-size:13px;color:#555;">
          Vidya, their AI tutor, will now guide ${data.studentName} step by step.
        </p>
      </div>

      <a href="${data.dashboardUrl}" style="${BTN}">View progress</a>

      ${FOOTER}
    </div>
  `;
}

export function planGeneratedForParentHtml(data: {
  parentName: string;
  studentName: string;
  subjectName: string;
  dashboardUrl: string;
}): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#1D9E75;">${data.studentName}'s learning plan is ready</h2>
      <p>Hi ${data.parentName},</p>
      <p>${data.studentName}'s personalised ${data.subjectName} learning plan has been generated
         on Spinzy Academy. Vidya has mapped out the topics they will cover this week, starting
         from where they are right now.</p>

      <div style="background:#EAF3DE;border-radius:12px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#1D9E75;font-weight:600;">
          Learning plan for ${data.subjectName} is live
        </p>
        <p style="margin:8px 0 0;font-size:13px;color:#555;">
          Encourage ${data.studentName} to complete at least one session today.
        </p>
      </div>

      <a href="${data.dashboardUrl}" style="${BTN}">See the plan</a>

      ${FOOTER}
    </div>
  `;
}

export function sessionCompleteForParentHtml(data: {
  parentName: string;
  studentName: string;
  topicName: string;
  subjectName: string;
  sessionDate: string;
  dashboardUrl: string;
  xpEarned?: number;
  totalXp?: number;
  badges?: string[];
  accuracy?: number; // percent
  masteryDelta?: number;
  masteryAfter?: number;
  sessionDurationMinutes?: number;
  aiInsight?: string;
  topicsTouched?: Array<{
    topicId: string
    topicName?: string | null
    chapterName?: string | null
    concepts: Array<{ conceptId: string; conceptName?: string | null; masteryAfter?: number | null; masteryDelta?: number | null }>
  }>
  chaptersCompleted?: Array<{ chapterId: string; chapterName: string; completed: boolean }>
}): string {
  const xpLine = typeof data.xpEarned === 'number' ? `<tr><td style="color:#666;">XP earned</td><td style="text-align:right;font-weight:600;">+${data.xpEarned}</td></tr>` : '';
  const totalXpLine = typeof data.totalXp === 'number' ? `<tr><td style="color:#666;">Total XP</td><td style="text-align:right;font-weight:600;">${data.totalXp}</td></tr>` : '';
  // Use qualitative labels for accuracy and mastery -- never raw numeric scores.
  const accuracyLabel = typeof data.accuracy === 'number'
    ? (data.accuracy >= 80 ? 'Strong' : data.accuracy >= 55 ? 'Good' : 'Keep going')
    : null;
  const accuracyLine = accuracyLabel ? `<tr><td style="color:#666;">Practice performance</td><td style="text-align:right;font-weight:600;">${accuracyLabel}</td></tr>` : '';
  const masteryLabel = typeof data.masteryAfter === 'number'
    ? (data.masteryAfter >= 0.7 ? 'Strong' : data.masteryAfter >= 0.45 ? 'Building' : 'Developing')
    : null;
  const masteryLine = masteryLabel ? `<tr><td style="color:#666;">Topic understanding</td><td style="text-align:right;font-weight:600;">${masteryLabel}</td></tr>` : '';
  const durationLine = typeof data.sessionDurationMinutes === 'number' ? `<tr><td style="color:#666;">Duration</td><td style="text-align:right;font-weight:600;">${data.sessionDurationMinutes} min</td></tr>` : '';
  const badgesHtml = data.badges && data.badges.length ? `<p style="margin:8px 0 0;font-size:13px;color:#555;">Badges: <strong>${data.badges.join(', ')}</strong></p>` : '';
    const insightText = data.aiInsight ? String(data.aiInsight).trim() : '';
    const insightShort = insightText ? (insightText.length > 240 ? insightText.slice(0, 237) + '...' : insightText) : '';
    const insightHtml = insightShort ? `<p style="margin:12px 0 0;color:#374151;font-size:13px;">Teacher Vidya: ${insightShort}</p>` : '';

  // Compact topics list (limit to 6 for email brevity)
  const topics = (data.topicsTouched ?? [])
  const topicsPreview = topics.slice(0, 6).map(t => `
    <li style="margin:4px 0;font-size:13px;color:#374151;">${t.topicName ?? 'Topic'}${t.chapterName ? ` -- ${t.chapterName}` : ''} (${t.concepts.length} concept${t.concepts.length !== 1 ? 's' : ''})</li>`).join('')
  const topicsMore = topics.length > 6 ? `<p style="color:#666;font-size:12px;margin:6px 0 0;">and ${topics.length - 6} more topics...</p>` : ''

  const chapters = (data.chaptersCompleted ?? []).filter(c => c.completed)
  const chaptersHtml = chapters.length ? `<p style="margin:8px 0 0;font-size:13px;color:#555;">Chapters completed: <strong>${chapters.map(c => c.chapterName).slice(0,5).join(', ')}${chapters.length > 5 ? `, and ${chapters.length - 5} more` : ''}</strong></p>` : ''

  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#1D9E75;">Great session today!</h2>
      <p>Hi ${data.parentName},</p>
      <p>${data.studentName} completed a learning session on <strong>${data.topicName}</strong>
         (${data.subjectName}) on ${data.sessionDate}. Vidya guided them through the topic
         and they are making steady progress.</p>

      <div style="background:#EAF3DE;border-radius:12px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#1D9E75;font-weight:600;">Session highlights</p>
        <table width="100%" cellpadding="6" style="font-size:14px;border-top:1px solid #eee;margin-top:8px;">
          ${xpLine}
          ${totalXpLine}
          ${accuracyLine}
          ${masteryLine}
          ${durationLine}
        </table>
        ${badgesHtml}
        ${insightHtml}
        ${topics.length ? `<div style="margin-top:12px;"><strong style="font-size:13px;color:#374151;">Topics covered</strong><ul style="margin:8px 0 0;padding-left:18px;">${topicsPreview}</ul>${topicsMore}</div>` : ''}
        ${chaptersHtml}
      </div>

      <a href="${data.dashboardUrl}" style="${BTN}">View progress</a>

      ${FOOTER}
    </div>
  `;
}

export function sessionCompleteForStudentHtml(data: {
  studentName: string;
  conceptName: string | null;
  xpEarned: number;
  totalXp: number;
  currentStreak: number;
  masteryDelta: number;
  accuracy: number;
  badgeNames: string[];
  sessionDurationMinutes: number;
  leveledUp: boolean;
  newLevel: number | null;
  dashboardUrl: string;
}): string {
  const topicLabel = data.conceptName ? `<strong>${data.conceptName}</strong>` : "today's topic";

  const levelUpBanner = data.leveledUp && data.newLevel
    ? `<div style="background:#EEEDFE;border-radius:12px;padding:14px 20px;margin:16px 0;text-align:center;">
        <p style="margin:0;font-size:15px;color:#534AB7;font-weight:700;">
          Level ${data.newLevel} unlocked! Keep climbing.
        </p>
      </div>`
    : '';

  const masteryLine = data.masteryDelta > 0.05
    ? `<li style="margin-bottom:6px;">Your understanding of ${topicLabel} improved this session.</li>`
    : '';

  const practicePerformanceLine = data.accuracy >= 0.8
    ? '<li style="margin-bottom:6px;">Strong practice performance -- your consistency is building real understanding.</li>'
    : data.accuracy >= 0.5
    ? '<li style="margin-bottom:6px;">Good effort on practice today -- every session builds your confidence.</li>'
    : '<li style="margin-bottom:6px;">You showed up and practised -- that is the first step to improvement.</li>';

  const streakLine = data.currentStreak >= 2
    ? `<li style="margin-bottom:6px;">${data.currentStreak}-day streak -- your best is still ahead. Keep it going!</li>`
    : '';

  const badgesHtml = data.badgeNames.length > 0
    ? `<div style="margin:16px 0;">
        <p style="margin:0 0 6px;font-size:13px;color:#555;font-weight:600;">Badges earned this session:</p>
        <p style="margin:0;font-size:14px;color:#534AB7;">${data.badgeNames.join(', ')}</p>
      </div>`
    : '';

  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#1D9E75;">Great session today, ${data.studentName}!</h2>
      <p>You completed a ${data.sessionDurationMinutes}-minute session on ${topicLabel} with Vidya.</p>

      <div style="background:#EEEDFE;border-radius:12px;padding:16px 20px;margin:20px 0;text-align:center;">
        <p style="margin:0;font-size:28px;font-weight:700;color:#534AB7;">+${data.xpEarned} XP</p>
        <p style="margin:4px 0 0;font-size:13px;color:#555;">Total: ${data.totalXp} XP</p>
      </div>

      ${levelUpBanner}

      <ul style="padding-left:20px;line-height:1.8;color:#374151;font-size:14px;margin:16px 0;">
        ${masteryLine}
        ${practicePerformanceLine}
        ${streakLine}
      </ul>

      ${badgesHtml}

      <a href="${data.dashboardUrl}" style="${BTN}">Continue learning</a>

      ${FOOTER}
    </div>
  `;
}
