/**
 * POST /api/admin/users/[id]/reset-diagnostic
 * F-ADM-020 AC-04: Admin can reset a student's diagnostic for a subject.
 * Deletes the DiagnosticSession and all StudentConceptState rows for that subject.
 * Writes an audit log and sends a push notification to the student.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { AdminActionType } from '@prisma/client';
import { sendPushSafe } from '@/lib/push/send';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: studentId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const subjectId =
    typeof (body as any)?.subjectId === 'string' ? ((body as any).subjectId as string).trim() : '';
  const reason =
    typeof (body as any)?.reason === 'string' ? ((body as any).reason as string).trim() : '';

  if (!subjectId) {
    return NextResponse.json({ error: 'subject_required' }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400 });
  }

  // Verify student exists
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  // Verify DiagnosticSession exists for this student/subject pair
  const diagnostic = await prisma.diagnosticSession.findUnique({
    where: { studentId_subjectId: { studentId, subjectId } },
    select: { id: true },
  });
  if (!diagnostic) {
    return NextResponse.json({ error: 'diagnostic_not_found' }, { status: 404 });
  }

  // Collect conceptIds for this subject so we can delete StudentConceptState rows
  const concepts = await prisma.concept.findMany({
    where: { subjectId },
    select: { id: true },
  });
  const conceptIds = concepts.map((c) => c.id);

  try {
    await prisma.$transaction([
      // Delete diagnostic session
      prisma.diagnosticSession.delete({
        where: { studentId_subjectId: { studentId, subjectId } },
      }),
      // Delete all StudentConceptState rows for this student in this subject
      prisma.studentConceptState.deleteMany({
        where: {
          studentId,
          conceptId: { in: conceptIds },
        },
      }),
      // Audit trail
      prisma.auditLog.create({
        data: {
          adminId: session.user.id,
          targetEntity: 'DiagnosticSession',
          targetId: diagnostic.id,
          action: AdminActionType.DIAGNOSTIC_RESET,
          previousValue: { studentId, subjectId },
          newValue: { reset: true, conceptsCleared: conceptIds.length },
          reason,
        },
      }),
    ]);
  } catch (err) {
    logger.error('admin.resetDiagnostic.failed', {
      event: 'diagnostic_reset_error',
      context: { studentId, subjectId, adminId: session.user.id },
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'reset_failed' }, { status: 500 });
  }

  // Push notification is best-effort -- never let it fail the response
  void sendPushSafe(studentId, {
    title: 'Diagnostic Reset',
    body: 'Your diagnostic assessment has been reset. Please retake it to unlock personalised learning.',
    url: '/dashboard',
    tag: 'diagnostic_reset',
  });

  logger.info('admin.resetDiagnostic.completed', {
    event: 'diagnostic_reset',
    context: { studentId, subjectId, adminId: session.user.id, conceptsCleared: conceptIds.length },
  });

  return NextResponse.json({ ok: true, conceptsCleared: conceptIds.length });
}
