/**
 * POST /api/admin/users/[id]/merge-into/[targetId]
 * F-ADM-020 AC-06: Merge a duplicate student account into a target account.
 *
 * Merge rules:
 * - LearningSessions: all reassigned from source to target
 * - DiagnosticSessions: source sessions skipped if target already has one for that subjectId
 * - StudentConceptState: per-concept, keep whichever has higher masteryScore
 * - Subscriptions: keep the one with the later endDate on the target account;
 *   deactivate the other
 * - Source account: set status='suspended' (soft delete)
 *
 * Body: { reason: string }
 * Returns: { ok: true, merged: { sessions, diagnostics, conceptStates, subscription } }
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { logger } from '@/lib/logger'
import { AdminActionType } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string; targetId: string }> },
) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: sourceId, targetId } = await context.params

  if (sourceId === targetId) {
    return NextResponse.json({ error: 'cannot_merge_self', message: 'Source and target must be different accounts' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const reason = typeof (body as any)?.reason === 'string' ? ((body as any).reason as string).trim() : ''
  if (!reason) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400 })
  }

  const [sourceUser, targetUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: sourceId }, select: { id: true, status: true } }),
    prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }),
  ])
  if (!sourceUser) return NextResponse.json({ error: 'source_not_found' }, { status: 404 })
  if (!targetUser) return NextResponse.json({ error: 'target_not_found' }, { status: 404 })

  // ── Step 1: Reassign LearningSessions ────────────────────────────────────
  const { count: sessionCount } = await prisma.learningSession.updateMany({
    where: { studentId: sourceId },
    data: { studentId: targetId },
  })

  // ── Step 2: Merge DiagnosticSessions (skip if target already has one) ────
  const [sourceDiags, targetDiags] = await Promise.all([
    prisma.diagnosticSession.findMany({ where: { studentId: sourceId }, select: { id: true, subjectId: true } }),
    prisma.diagnosticSession.findMany({ where: { studentId: targetId }, select: { subjectId: true } }),
  ])
  const targetSubjectIds = new Set(targetDiags.map((d) => d.subjectId))
  const diagsToReassign = sourceDiags.filter((d) => !targetSubjectIds.has(d.subjectId))
  const diagsToDelete = sourceDiags.filter((d) => targetSubjectIds.has(d.subjectId))

  let diagnosticsMerged = 0
  if (diagsToReassign.length > 0) {
    await prisma.diagnosticSession.updateMany({
      where: { id: { in: diagsToReassign.map((d) => d.id) } },
      data: { studentId: targetId },
    })
    diagnosticsMerged = diagsToReassign.length
  }
  if (diagsToDelete.length > 0) {
    await prisma.diagnosticSession.deleteMany({
      where: { id: { in: diagsToDelete.map((d) => d.id) } },
    })
  }

  // ── Step 3: Merge StudentConceptState (keep higher masteryScore) ──────────
  const [sourceStates, targetStates] = await Promise.all([
    prisma.studentConceptState.findMany({ where: { studentId: sourceId } }),
    prisma.studentConceptState.findMany({ where: { studentId: targetId } }),
  ])
  const targetStateMap = new Map(targetStates.map((s) => [s.conceptId, s]))
  let conceptStatesMerged = 0

  for (const src of sourceStates) {
    const tgt = targetStateMap.get(src.conceptId)
    if (!tgt) {
      // Target has no state for this concept -- reassign
      await prisma.studentConceptState.update({
        where: { id: src.id },
        data: { studentId: targetId },
      })
      conceptStatesMerged++
    } else if (src.masteryScore > tgt.masteryScore) {
      // Source has higher mastery -- update target with better values
      await prisma.studentConceptState.update({
        where: { id: tgt.id },
        data: {
          masteryScore: src.masteryScore,
          attemptCount: Math.max(src.attemptCount, tgt.attemptCount),
          theta: src.theta,
          stability: src.stability,
          retention: src.retention,
          memoryStrength: Math.round((src.masteryScore * (src.retention ?? 1)) * 1000) / 1000,
        },
      })
      await prisma.studentConceptState.delete({ where: { id: src.id } })
      conceptStatesMerged++
    } else {
      // Target has equal or higher mastery -- discard source state
      await prisma.studentConceptState.delete({ where: { id: src.id } })
    }
  }

  // ── Step 4: Subscription -- keep the one with the later endDate ───────────
  const [sourceSubs, targetSubs] = await Promise.all([
    prisma.subscription.findMany({ where: { userId: sourceId }, orderBy: { endDate: 'desc' }, take: 1 }),
    prisma.subscription.findMany({ where: { userId: targetId }, orderBy: { endDate: 'desc' }, take: 1 }),
  ])
  const sourceBestSub = sourceSubs[0] ?? null
  const targetBestSub = targetSubs[0] ?? null
  let subscriptionAction = 'none'

  if (sourceBestSub && (!targetBestSub || sourceBestSub.endDate > targetBestSub.endDate)) {
    // Source has a better subscription -- move it to target and deactivate target's if any
    await prisma.subscription.update({ where: { id: sourceBestSub.id }, data: { userId: targetId } })
    if (targetBestSub) {
      await prisma.subscription.update({ where: { id: targetBestSub.id }, data: { active: false } })
    }
    subscriptionAction = 'source_preferred'
  } else if (sourceBestSub) {
    // Target has a better or equal subscription -- deactivate source's
    await prisma.subscription.update({ where: { id: sourceBestSub.id }, data: { active: false } })
    subscriptionAction = 'target_preferred'
  }

  // ── Step 5: Soft-delete source account ───────────────────────────────────
  await prisma.$transaction([
    prisma.user.update({ where: { id: sourceId }, data: { status: 'suspended' } }),
    prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'User',
        targetId: sourceId,
        action: AdminActionType.ACCOUNT_SUSPEND,
        previousValue: { sourceId, targetId, operation: 'merge_into' },
        newValue: {
          sessionsMerged: sessionCount,
          diagnosticsMerged,
          conceptStatesMerged,
          subscriptionAction,
        },
        reason,
      },
    }),
  ])

  logger.info('admin.users.mergeInto.completed', {
    event: 'account_merge',
    context: { sourceId, targetId, adminId: session.user.id, sessionCount, conceptStatesMerged },
  })

  return NextResponse.json({
    ok: true,
    merged: {
      sessions: sessionCount,
      diagnostics: diagnosticsMerged,
      conceptStates: conceptStatesMerged,
      subscriptionAction,
    },
  })
}
