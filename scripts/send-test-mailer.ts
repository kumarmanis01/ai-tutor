/**
 * FILE OBJECTIVE:
 * - Safe one-off script to call `sendMailSafe` directly and attempt a QA email send
 *   without touching the database or worker code paths.
 *
 * USAGE:
 * npx tsx -r tsconfig-paths/register scripts/send-test-mailer.ts
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | created
 */

import { sendMailSafe } from '@/lib/mailer'

async function main() {
  const qa = process.env.QA_EMAIL ?? 'spinzy.healthians@gmail.com'
  const subject = `QA: weekly digest send (mailer-only) — ${new Date().toISOString()}`
  const html = `<!doctype html><html><body><h2>QA Digest Render Test</h2><p>This is a mailer-only test — no DB or worker paths were exercised.</p></body></html>`

  console.log('Invoking sendMailSafe to', qa)
  await sendMailSafe({ to: qa, subject, html, text: 'QA: weekly digest send (mailer-only)' })
  console.log('sendMailSafe invoked (errors suppressed by helper).')
}

main().catch((e) => {
  console.error('send-test-mailer failed', e)
  process.exit(1)
})
