/**
 * FILE OBJECTIVE:
 * - Handle admin user detail operations: retrieve, update profile, and permanently delete users.
 *   DELETE endpoint now properly cascades deletion through referral FK constraints.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/users/[id]/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 * - CLAUDE.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | copilot | created handler with PATCH and DELETE methods
 * - 2026-05-19T12:00:00Z | claude  | fix: DELETE now cascades through referral FK constraints; clears referralRewards, referrals (created/redeemed), and deletionRequest before user deletion
 * - 2026-05-19T19:00:00Z | copilot | fix: DELETE now clears non-cascade User FKs (diagnostic/mock exam/session flags/doubt/payment/history/content) before user deletion
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';
import { invalidateUserSessionCache } from '@/lib/auth';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { AdminActionType } from '@prisma/client';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await req.json();

  if (body.grade !== undefined) {
    // Grade-change path: requires explicit reason + full audit trail
    // grade changes require explicit reason + audit log -- handled here
    if (!body.reason || String(body.reason).trim() === '') {
      return NextResponse.json(
        { error: 'reason_required', message: 'A reason is required for grade changes.' },
        { status: 400 }
      );
    }

    const current = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { grade: true, email: true },
    });

    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { grade: body.grade } }),
      prisma.auditLog.create({
        data: {
          adminId:       session.user.id,
          targetEntity:  'User',
          targetId:      id,
          action:        AdminActionType.GRADE_CHANGE,
          previousValue: { grade: current.grade },
          newValue:      { grade: body.grade },
          reason:        String(body.reason).trim(),
        },
      }),
      // Grade change invalidates all mastery data and learning plans
      prisma.studentConceptState.deleteMany({ where: { studentId: id } }),
      // LearningPlanItem rows cascade-delete (onDelete: Cascade on plan relation)
      prisma.learningPlan.deleteMany({ where: { studentId: id } }),
    ]);

    // Invalidate short-lived session cache for the user (best-effort)
    try {
      await invalidateUserSessionCache(current.email);
    } catch {}

    logApiUsage(`/api/admin/users/${id}`, 'PATCH');
    return NextResponse.json({ ok: true });
  }

  // General update path -- strip grade and board (immutable after first save)
  const { grade: _g, board: _b, reason: _r, ...safeData } = body;
  // grade changes require explicit reason + audit log -- handled above
  const user = await prisma.user.update({ where: { id }, data: safeData });
  try {
    await invalidateUserSessionCache((user as any)?.email);
  } catch {}
  logApiUsage(`/api/admin/users/${id}`, 'PATCH');
  return NextResponse.json(user);
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  const auditAdminId = session.user.id === id ? null : session.user.id;

  try {
    await prisma.$transaction([
      // Null out optional foreign keys that do not cascade on delete.
      prisma.room.updateMany({ where: { createdBy: id }, data: { createdBy: null } }),
      prisma.auditLog.updateMany({ where: { adminId: id }, data: { adminId: null } }),
      prisma.approvalAudit.updateMany({ where: { actorId: id }, data: { actorId: null } }),

      // Delete rows with non-cascade references to this user.
      prisma.phoneOtp.deleteMany({ where: { userId: id } }),
      prisma.trial.deleteMany({ where: { userId: id } }),
      prisma.chatHistory.deleteMany({ where: { userId: id } }),
      prisma.chat.deleteMany({ where: { userId: id } }),
      prisma.event.deleteMany({ where: { userId: id } }),
      prisma.payment.deleteMany({ where: { userId: id } }),
      prisma.contentRecommendation.deleteMany({ where: { userId: id } }),
      prisma.apiUsage.deleteMany({ where: { userId: id } }),
      prisma.generatedStudyContent.deleteMany({ where: { generatedBy: id } }),
      prisma.studentStudyBookmark.deleteMany({ where: { userId: id } }),
      prisma.doubtEscalation.deleteMany({ where: { studentId: id } }),
      prisma.sessionQuestionFlag.deleteMany({ where: { studentId: id } }),
      prisma.diagnosticSession.deleteMany({ where: { studentId: id } }),
      prisma.mockExamSectionAttempt.deleteMany({ where: { attempt: { studentId: id } } }),
      prisma.mockExamAttempt.deleteMany({ where: { studentId: id } }),

      // Delete referral rewards related to this user
      prisma.referralReward.deleteMany({ where: { userId: id } }),
      // Delete referrals created by this user
      prisma.referral.deleteMany({ where: { createdBy: id } }),
      // Delete referrals redeemed by this user
      prisma.referral.deleteMany({ where: { redeemedBy: id } }),
      // Delete deletion request record (if exists)
      prisma.deletionRequest.deleteMany({ where: { userId: id } }),

      // Audit the deletion within the same transaction.
      prisma.auditLog.create({
        data: {
          adminId:      auditAdminId,
          targetEntity: 'User',
          targetId:     id,
          action:       AdminActionType.ERASURE_PURGE,
        },
      }),

      // Finally delete the user (all other FKs have onDelete: Cascade or are optional)
      prisma.user.delete({ where: { id } }),
    ]);
    logApiUsage(`/api/admin/users/${id}`, 'DELETE');
    return NextResponse.json({ ok: true, user: { id } });
  } catch (err) {
    logger.error('admin.users.delete.failed', {
      event: 'admin.users.delete.failed',
      context: {
        adminId: session.user.id,
        targetUserId: id,
        error: err instanceof Error ? err.message : 'unknown_error',
      },
    });

    return NextResponse.json(
      { error: 'delete_failed', message: 'Failed to delete user' },
      { status: 500 },
    );
  }
}
