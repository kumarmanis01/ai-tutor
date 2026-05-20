/**
 * FILE OBJECTIVE:
 * - Admin endpoint to send broadcast reminders to students who have not completed diagnostics.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/admin/notifications/trigger-pending-diagnostics.route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-14T00:00:00Z | copilot | add standard file header for template migration
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { sendPushSafe } from '@/lib/push/send'
import { sendEmailUnifiedSafe } from '@/lib/mail'
import { adminBroadcastEmailHtml } from '@/lib/email/templates'
import { logger } from '@/lib/logger'
export async function POST(_req: NextRequest) {
  const session = await getServerSessionForHandlers()
  if (!session) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 })

  try {
    // Students who have at least one completed diagnostic
    const completed = await prisma.diagnosticSession.findMany({ where: { status: 'COMPLETED' }, select: { studentId: true }, distinct: ['studentId'] })
    const completedIds = completed.map(c => c.studentId)

    const targets = await prisma.user.findMany({ where: { role: 'user', id: { notIn: completedIds } }, select: { id: true, email: true, whatsappPhone: true } })

    const title = "Complete your diagnostic test"
    const body = "Complete a short diagnostic test to get your personalised learning plan. Tap to start now."

    // Fire-and-forget sends (safe helpers handle failures)
    for (const t of targets) {
      try {
        void sendPushSafe(t.id, { title, body })
        if (t.email) void sendEmailUnifiedSafe({ mode: 'raw', delivery: 'best_effort', to: t.email, subject: title, html: adminBroadcastEmailHtml({ title, body, ctaUrl: 'https://spinzyacademy.com/diagnostic' }), reason: 'pending_diagnostic_reminder', featureFlagDomain: 'notification' })
      } catch (e) {
        logger.warn('[notifications/trigger-pending-diagnostics] send failed for user', { userId: t.id, error: String(e) })
      }
    }

    // Record high-level audit row for admin visibility
    await prisma.notificationLog.create({ data: { audience: 'pending_diagnostic', channel: 'push', title, body, sentTo: targets.length, status: 'sent', adminId: session.user.id } }).catch(() => {})

    logger.info('[notifications/trigger-pending-diagnostics] triggered', { adminId: session.user.id, targets: targets.length })
    return NextResponse.json({ ok: true, sentTo: targets.length })
  } catch (err) {
    logger.error('[notifications/trigger-pending-diagnostics] failed', { error: String(err) })
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed to trigger', ok: false }, { status: 500 })
  }
}
