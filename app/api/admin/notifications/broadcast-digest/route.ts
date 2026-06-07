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
import { getRedis } from '@/lib/redis'

// Cooldown between broadcast triggers. Stops two admin clicks (or two
// admins clicking) from double-sending the digest to every parent.
// Weekly cadence so 1h is plenty of buffer; admin can wait it out if a
// genuine re-run is needed.
const BROADCAST_DEDUP_KEY = 'admin:broadcast_digest:lock'
const BROADCAST_DEDUP_TTL_SECONDS = 60 * 60

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
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Dedup: a second trigger inside the cooldown window is refused so two
  // admin clicks do not double-send the weekly digest. Redis SETNX with
  // TTL is the canonical pattern in this codebase (cf. learningPlanRegeneration).
  const redis = getRedis?.()
  if (redis) {
    try {
      const lockResult = await (redis as any).set(
        BROADCAST_DEDUP_KEY,
        session.user.id,
        'EX',
        BROADCAST_DEDUP_TTL_SECONDS,
        'NX',
      )
      if (lockResult !== 'OK') {
        logger.warn('[broadcast-digest] dedup hit -- broadcast skipped', {
          event: 'broadcast_digest_dedup_skipped',
          context: { adminId: session.user.id },
        })
        return NextResponse.json(
          {
            error: 'already_running',
            message: 'A broadcast was triggered recently. Please wait before retrying.',
          },
          { status: 409 },
        )
      }
    } catch (err) {
      logger.warn('[broadcast-digest] dedup check failed; proceeding', {
        event: 'broadcast_digest_dedup_unavailable',
        context: { error: err instanceof Error ? err.message : String(err) },
      })
    }
  }

  let queued = 0
  try {
    queued = await prisma.parentStudent.count({ where: { status: 'active' } })
  } catch (err) {
    logger.warn('[broadcast-digest] active-link count failed; proceeding with 0', {
      event: 'broadcast_digest_count_failed',
      context: { error: err instanceof Error ? err.message : String(err) },
    })
  }

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
