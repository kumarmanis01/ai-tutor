import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';
import { invalidateUserSessionCache } from '@/lib/auth';
import { getServerSessionForHandlers } from '@/lib/session';
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

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { status: 'suspended' } }),
      prisma.auditLog.create({
        data: {
          adminId:      session.user.id,
          targetEntity: 'User',
          targetId:     id,
          action:       AdminActionType.ACCOUNT_SUSPEND,
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
