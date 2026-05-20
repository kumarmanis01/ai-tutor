/**
 * POST /api/admin/notifications/broadcast-digest
 *
 * Sends the weekly digest email to ALL active linked parents.
 * Fire-and-forget: returns immediately after queuing, sends async.
 * Auth: admin role required.
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { sendEmailUnifiedSafe } from '@/lib/mail'
import { weeklyDigestHtml } from '@/lib/email/templates'
import { logger } from '@/lib/logger'

async function fetchStudentDigestData(studentId: string) {
  const [student, masteryRow, streak] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { name: true, grade: true },
    }),
    prisma.studentTopicProgress.aggregate({
      where: { studentId },
      _avg: { mastery: true },
    }),
    prisma.studentStreak.findFirst({
      where: { studentId, kind: 'daily' },
      select: { current: true },
    }),
  ])
  return { student, masteryRow, streak }
}

async function sendDigestsAsync(adminId: string) {
  const links = await prisma.parentStudent.findMany({
    where: { status: 'active' },
    include: {
      parent: { select: { id: true, name: true, email: true, parentEmail: true } },
      student: { select: { id: true, name: true, grade: true } },
    },
  })

  let sent = 0
  for (const link of links) {
    const recipientEmail = link.parent.email ?? link.parent.parentEmail
    if (!recipientEmail) continue

    try {
      const { student, masteryRow, streak } = await fetchStudentDigestData(link.studentId)
      const readiness = Math.round((masteryRow._avg.mastery ?? 0) * 100)
      const html = weeklyDigestHtml({
        studentName: student?.name ?? 'Your child',
        sessionsThisWeek: 0,
        weeklyGoal: 5,
        readinessScore: readiness,
        topSubject: '',
        streakDays: streak?.current ?? 0,
        parentName: link.parent.name ?? undefined,
      })
      await sendEmailUnifiedSafe({
        mode: 'raw',
        delivery: 'best_effort',
        to: recipientEmail,
        subject: `${student?.name ?? 'Your child'}'s weekly learning report`,
        html,
        reason: 'parent_weekly_digest',
        featureFlagDomain: 'notification',
      })
      sent++
    } catch (err) {
      logger.error('[broadcast-digest] Failed to send to parent', {
        event: 'broadcast_digest_error',
        context: { parentId: link.parentId, studentId: link.studentId },
        err: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info('[broadcast-digest] Digest broadcast complete', {
    event: 'broadcast_digest_done',
    context: { adminId, sent, total: links.length },
  })
}

export async function POST() {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  const queued = await prisma.parentStudent
    .count({ where: { status: 'active' } })
    .catch(() => 0)

  // Fire and forget -- do not await
  ;(async () => {
    try {
      await sendDigestsAsync(session.user.id)
    } catch (err) {
      logger.error('[broadcast-digest] Unhandled error in async send', { err })
    }
  })()

  logger.info('[broadcast-digest] Digest broadcast triggered', {
    event: 'broadcast_digest_triggered',
    context: { adminId: session.user.id, queued },
  })

  return NextResponse.json({ ok: true, queued })
}
