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
 */

import { TEMPLATES_LEGACY_SUPPORT_EMAIL } from '@/lib/email/functionalityEmails';

// ── Shared primitives ─────────────────────────────────────────────────────────

const BASE: string = [
  'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;',
  'max-width:520px;',
  'margin:0 auto;',
  'color:#1a1a1a;',
  'padding:0 8px;',
].join('');

const BTN: string = [
  'display:inline-block;',
  'padding:12px 28px;',
  'background:#534AB7;',
  'color:#ffffff;',
  'text-decoration:none;',
  'border-radius:8px;',
  'font-weight:600;',
  'font-size:15px;',
].join('');

const FOOTER: string = `
  <p style="color:#888;font-size:12px;margin-top:32px;
             border-top:1px solid #eee;padding-top:16px;">
    Spinzy Academy -- AI Home Tutor<br>
    You are receiving this because you have a Spinzy Academy account.
  </p>
`;

// Email templates require fully-qualified <img> tags for wide client compatibility.
// These are intentionally raw HTML image tags (absolute URLs) and include
// `alt` and size attributes for accessibility and predictable layout in mail clients.
const LOGO: string = `
  <img src="https://spinzyacademy.com/icons/spinzy-navbar-source.png"
       alt="Spinzy Academy" height="40"
       style="margin-bottom:24px;display:block;">
`;

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
  const { childName, severity } = params
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root { --bg:#ffffff; --text:#111827; --muted:#6b7280; --primary:#4f46e5; --success:#16a34a; --warning:#d97706; --card-bg:#f9fafb; --card-border:rgba(0,0,0,0.06); }
    @media (prefers-color-scheme: dark) { :root { --bg:#0b1220; --text:#e6eef8; --muted:#94a3b8; --primary:#8b77ff; } }
    body { background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; margin:0; padding:24px; }
    .container { max-width:560px; margin:0 auto; }
    .header { text-align:center; margin-bottom:18px; }
    .logo { display:block; margin:0 auto 8px; }
    .card { border:1px solid var(--card-border); background:var(--card-bg); border-radius:12px; padding:14px; margin:12px 0; }
    .row { width:100%; display:flex; gap:8px; }
    .stat { flex:1; text-align:center; padding:8px; border-radius:8px; }
    .num { font-size:20px; font-weight:700; }
    .muted { color:var(--muted); font-size:12px; }
    .narrative { margin-top:12px; padding:12px; border-radius:8px; background:transparent; }
    .cta { text-align:center; margin-top:14px; }
    .btn { display:inline-block; padding:12px 22px; background:var(--primary); color:#fff; text-decoration:none; border-radius:8px; font-weight:600; }
    @media (max-width:480px) { .row { flex-direction:column; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img class="logo" src="https://spinzy.in/logos/logo-email.png" width="176" height="50" alt="Spinzy Academy" style="display:block;" />
      <div class="muted" style="margin-top:6px;font-size:13px;">Weekly learning update</div>
    </div>

    <p>Hi ${parentName},</p>

    <div class="card">
      <h2 style="margin:0 0 10px;font-size:16px;color:var(--text);">${childName}</h2>

      <div class="row" role="group" aria-label="weekly-stats">
        <div class="stat" style="background:rgba(79,70,229,0.06);">
          <div class="num" style="color:var(--primary);">${sessionsThisWeek}</div>
          <div class="muted">Sessions this week</div>
        </div>
        <div class="stat" style="background:rgba(217,119,6,0.06);">
          <div class="num" style="color:var(--warning);">${streak}</div>
          <div class="muted">Day streak</div>
        </div>
      </div>

      ${deltaLine}

      ${narrative ? `<div class="narrative" style="border-left:3px solid ${readinessDelta !== null && readinessDelta > 0.05 ? '#16A34A' : '#D1FAE5'}; background:transparent;"><p style="margin:0;color:var(--text);">${narrative}</p></div>` : ''}
    </div>

    <div class="cta">
      <a class="btn" href="${dashboardUrl}">View full progress →</a>
    </div>

    <div class="footer" style="color:#6B7280;font-size:12px;text-align:center;margin-top:18px;">You're receiving this because you have linked student accounts on Spinzy.</div>
  </div>
</body>
</html>`
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
        <img src="https://spinzy.in/logos/logo-email.png" width="176" height="50" alt="Spinzy Academy" style="display:block;margin:0 auto;max-width:100%;height:auto;" />
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
}): string {
  return `
    <div style="${BASE}">
      ${LOGO}
      <h2 style="color:#1D9E75;">Great session today!</h2>
      <p>Hi ${data.parentName},</p>
      <p>${data.studentName} completed a learning session on <strong>${data.topicName}</strong>
         (${data.subjectName}) on ${data.sessionDate}. Vidya guided them through the topic
         and they are making steady progress.</p>

      <div style="background:#EAF3DE;border-radius:12px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#1D9E75;font-weight:600;">
          Session completed
        </p>
        <p style="margin:8px 0 0;font-size:13px;color:#555;">
          Consistent daily sessions are the fastest path to exam confidence.
        </p>
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
