/**
 * lib/email/templates.ts
 * All email HTML templates in one place.
 *
 * Rules:
 *  - Inline CSS only -- no external fonts, no external stylesheets
 *  - Plain table layout -- works in Gmail, Outlook, Apple Mail
 *  - Brand colours: #534AB7 (primary), #1D9E75 (success), #E24B4A (danger)
 *  - Copy rules: no "failed", "missed", "broke"; forward-looking tone
 */

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
    You are receiving this because you have a Spinzy account.
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
      <h2 style="color:#534AB7;">Welcome — your parent account is confirmed</h2>
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
        We collect and store learning analytics (sessions, answers, progress scores) to personalise instruction and show progress. We do not share personal data with third parties except vendors required to operate the service. Raw session transcripts used for model evaluation are pseudonymised and access-restricted. You can request data export or deletion by contacting support@spinzy.in.
      </p>

      <a href="https://spinzyacademy.com/parent/dashboard" style="${BTN}">Open parent dashboard</a>

      <p style="color:#888;font-size:13px;margin-top:16px;">
        Questions? Reply to this email or reach us at support@spinzy.in
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
        Questions? Reply to this email or reach us at support@spinzy.in
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
}): string {
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
        If you change your mind, contact support@spinzy.in within 7 days.
      </p>
      ${FOOTER}
    </div>
  `;
}
