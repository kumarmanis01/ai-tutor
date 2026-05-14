import { NextRequest, NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { sendPushSafe } from '@/lib/push/send'
import { sendMailSafe } from '@/lib/mailer'
import { logger } from '@/lib/logger'

/**
 * Trigger: send reminder to students who have not completed any diagnostic.
 * This is intended as a manual override for the scheduled Tuesday job.
 */
export async function POST(req: NextRequest) {
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
        if (t.email) void sendMailSafe({ to: t.email, subject: title, html: `<p>${body}</p>` })
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
