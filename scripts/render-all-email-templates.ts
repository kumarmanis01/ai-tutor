/**
 * FILE OBJECTIVE:
 * - Render all exported email templates to `tmp/email-previews/` for QA review
 *   and optionally send them to a QA inbox using `sendMailSafe`.
 *
 * USAGE:
 * npx tsx -r tsconfig-paths/register scripts/render-all-email-templates.ts
 *
 * Optional environment variables:
 * - QA_EMAIL: destination email when `SEND_QA=true` (default: env QA_EMAIL or spinzy.healthians@gmail.com)
 * - SEND_QA: when set to "true" the script will send each rendered template to `QA_EMAIL`.
 * - EMAIL_PREVIEW_DIR: output directory (default: tmp/email-previews)
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/render-all-email-templates.spec.ts (not included)
 *
 * EDIT LOG:
 * - 2026-05-20T00:00:00Z | copilot | created script to render + optionally send all templates
 */

import * as fs from 'fs'
import * as path from 'path'
import * as templates from '@/lib/email/templates'
import { sendMailSafe } from '@/lib/mailer'

const OUT_DIR = process.env.EMAIL_PREVIEW_DIR || path.join('tmp', 'email-previews')
const QA_EMAIL = process.env.QA_EMAIL || 'spinzy.healthians@gmail.com'
const SHOULD_SEND = String(process.env.SEND_QA || '').toLowerCase() === 'true'

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

function safeWrite(name: string, html: string) {
  const file = path.join(OUT_DIR, `${name}.html`)
  fs.writeFileSync(file, html, 'utf8')
}

// Sample argument fixtures for known templates. Add cases as needed.
const FIXTURES: Record<string, any[]> = {
  welcomeEmailHtml: ['Anil'],
  magicLinkHtml: ['https://spinzyacademy.com/magic/TEST'],
  parentOtpHtml: ['123456', 'Rohan'],
  parentWelcomeHtml: ['Meena', 'Rohan'],
  paymentReceiptHtml: [{ studentName: 'Rohan', plan: 'Monthly', amountRupees: 399, billingCycle: 'monthly', renewalDate: '2026-06-10' }],
  weeklyDigestHtml: [{ studentName: 'Rohan', sessionsThisWeek: 3, weeklyGoal: 5, readinessScore: 72, topSubject: 'Mathematics', streakDays: 4 }],
  distressAlertHtml: [{ studentName: 'Rohan', severity: 'high', sessionId: 'sess_qa_1', message: 'Example distress message excerpt' }],
  costAnomalyHtml: [{ dateLabel: '2026-05-20', sessions: 1200, totalCostUsd: 45.1234, costPerSession: 0.0376 }],
  contentJobFailureAlertHtml: [{ hydrationJobId: 'job_qa_1', lastError: 'Timeout', subject: 'Math', grade: 8, board: 'CBSE', adminUrl: 'https://spinzyacademy.com/admin/job', willRetryAt: new Date(Date.now() + 3600 * 1000) }],
  diagnosticReadyEmailHtml: [{ studentName: 'Rohan', subjectName: 'Mathematics', diagnosticUrl: 'https://spinzyacademy.com/diagnostic/qa' }],
  distressNotificationParentHtml: [{ childName: 'Rohan', severity: 'moderate' }],
  weeklyDigestParentHtml: [{ parentName: 'Meena', childName: 'Rohan', sessionsThisWeek: 3, streak: 2, readinessDelta: 0.06, narrative: 'Rohan showed steady improvement this week.', dashboardUrl: 'https://spinzyacademy.com/parent' }],
  parentDigestHtml: ['Meena', ['<p>child section sample</p>']],
  qaTestHtml: ['QA preview message'],
  deletionConfirmHtml: [],
  inactivityNudgeHtml: [{ parentName: 'Meena', studentName: 'Rohan', inactiveDays: 4, lastStudiedLabel: '2026-05-16' }],
  milestoneEmailHtml: [{ parentName: 'Meena', studentName: 'Rohan', milestoneLabel: 'Completed 50 practice questions', milestoneDetail: 'Strong practice streak', dashboardUrl: 'https://spinzyacademy.com/parent' }],
  adminBroadcastEmailHtml: [{ title: 'Admin test', body: 'This is a test broadcast created by QA.', ctaLabel: 'Open', ctaUrl: 'https://spinzyacademy.com' }],
  referralVoidedHtml: [{ name: 'Anil', code: 'REF123' }],
  parentPaymentFailedHtml: [{ name: 'Meena', retryUrl: 'https://spinzyacademy.com/billing', supportEmail: 'support@spinzyacademy.com' }],
  paymentRetryReminderHtml: [{ name: 'Meena', retryUrl: 'https://spinzyacademy.com/billing' }],
  graceStartedHtml: [{ name: 'Meena', untilLabel: '2026-05-23', billingUrl: 'https://spinzyacademy.com/billing' }],
  subscriptionExpiredHtml: [{ name: 'Meena', renewUrl: 'https://spinzyacademy.com/renew' }],
  trialEndingHtml: [{ name: 'Rohan', daysLeft: 2, upgradeUrl: 'https://spinzyacademy.com/upgrade' }],
  diagnosticCompleteForParentHtml: [{ parentName: 'Meena', studentName: 'Rohan', subjectName: 'Mathematics', placement: 'Grade 8 - Level B', dashboardUrl: 'https://spinzyacademy.com/parent' }],
  planGeneratedForParentHtml: [{ parentName: 'Meena', studentName: 'Rohan', subjectName: 'Mathematics', dashboardUrl: 'https://spinzyacademy.com/parent' }],
  sessionCompleteForParentHtml: [{ parentName: 'Meena', studentName: 'Rohan', topicName: 'Quadratic equations', subjectName: 'Mathematics', sessionDate: '2026-05-20', dashboardUrl: 'https://spinzyacademy.com/parent', xpEarned: 20, totalXp: 520, badges: ['Focus Champion'], accuracy: 85, masteryAfter: 0.72, sessionDurationMinutes: 18 }],
  sessionCompleteForStudentHtml: [{ studentName: 'Rohan', conceptName: 'Quadratic equations', xpEarned: 20, totalXp: 520, currentStreak: 3, masteryDelta: 0.08, accuracy: 0.86, badgeNames: ['Focus Champion'], sessionDurationMinutes: 18, leveledUp: true, newLevel: 5, dashboardUrl: 'https://spinzyacademy.com/dashboard' }],
}

async function main() {
  ensureOutDir()

  const exported = Object.keys(templates).filter((k) => typeof (templates as any)[k] === 'function')
  console.log(`Found ${exported.length} exported template functions`) 

  for (const name of exported) {
    try {
      const fn = (templates as any)[name]
      const args = FIXTURES[name] ?? []
      let html = ''
      try {
        html = fn(...args)
      } catch (e) {
        html = `<!-- Failed to render ${name}: ${String(e)} -->`
      }

      safeWrite(name, html)
      console.log('Wrote preview for', name)

      if (SHOULD_SEND) {
        const subject = `QA: email preview - ${name}`
        console.log(`Sending ${name} to ${QA_EMAIL}`)
        await sendMailSafe({ to: QA_EMAIL, subject, html, text: `Preview: ${name}` })
      }
    } catch (err) {
      console.error('Error processing template', name, err)
    }
  }

  console.log('Email preview render complete. Output directory:', OUT_DIR)
  if (!SHOULD_SEND) console.log('To also send previews, set SEND_QA=true and QA_EMAIL in the environment')
}

main().catch((e) => {
  console.error('render-all-email-templates failed', e)
  process.exit(1)
})
