/**
 * FILE OBJECTIVE:
 * - One-off script to request a parent digest send to a QA email for verification.
 *
 * USAGE:
 * npx tsx -r tsconfig-paths/register scripts/send-test-digest.ts
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | created
 */

import { sendParentMilestoneNotification } from '@/lib/notifications/delivery'

async function main() {
  const qa = process.env.QA_EMAIL ?? 'spinzy.healthians@gmail.com'
  const subject = `QA: weekly digest test -- ${new Date().toISOString()}`
  const html = `<p>This is a QA test of the weekly digest rendering.</p><p>If you received this, the worker's delivery path was exercised.</p>`

  console.log('Attempting QA digest send to', qa)
  const res = await sendParentMilestoneNotification('qa-test-parent', {
    email: qa,
    subject,
    html,
    text: 'QA: weekly digest test',
    meta: { type: 'digest', channel: 'email' },
  })

  console.log('Result:', res)
}

main().catch((e) => {
  console.error('Script failed', e)
  process.exit(1)
})
