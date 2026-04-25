/**
 * PATCH /api/admin/subjects/[id]/availability
 * F-ADM-002 AC-05: Admin toggles subject availability on/off.
 *
 * Body: { isAvailable: boolean, reason: string }
 * Returns: { ok: true, subjectId, isAvailable }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { AdminActionType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: subjectId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const isAvailable = (body as any)?.isAvailable;
  if (typeof isAvailable !== 'boolean') {
    return NextResponse.json(
      { error: 'isAvailable_required', message: 'isAvailable must be a boolean' },
      { status: 400 }
    );
  }

  const reason =
    typeof (body as any)?.reason === 'string' ? ((body as any).reason as string).trim() : '';
  if (!reason) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400 });
  }

  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: { id: true, name: true, isAvailable: true },
  });
  if (!subject) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 });
  }

  if (subject.isAvailable === isAvailable) {
    return NextResponse.json(
      {
        error: 'no_change',
        message: `Subject is already ${isAvailable ? 'available' : 'unavailable'}`,
      },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.subjectDef.update({
      where: { id: subjectId },
      data: { isAvailable },
    }),
    prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'SubjectDef',
        targetId: subjectId,
        action: AdminActionType.FEATURE_FLAG_CHANGE,
        previousValue: { isAvailable: subject.isAvailable },
        newValue: { isAvailable },
        reason,
      },
    }),
  ]);

  logger.info('admin.subjectAvailability.updated', {
    event: 'subject_availability_change',
    context: { subjectId, subjectName: subject.name, isAvailable, adminId: session.user.id },
  });

  return NextResponse.json({ ok: true, subjectId, isAvailable });
}
