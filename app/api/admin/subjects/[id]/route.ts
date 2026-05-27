/**
 * FILE OBJECTIVE:
 * - PATCH /api/admin/subjects/[id] -- update subjectType and targetLanguage.
 *
 * EDIT LOG:
 * - 2026-05-27 | claude | created for subject-type management
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { AdminActionType, SubjectType } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_SUBJECT_TYPES = Object.values(SubjectType);

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const subjectType = (body as any)?.subjectType;
  const targetLanguage = (body as any)?.targetLanguage;

  if (subjectType !== undefined && !VALID_SUBJECT_TYPES.includes(subjectType)) {
    return NextResponse.json(
      { error: 'invalid_subject_type', message: `subjectType must be one of: ${VALID_SUBJECT_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  // targetLanguage is required when subjectType is LANGUAGE, must be empty otherwise
  if (subjectType === SubjectType.LANGUAGE) {
    if (!targetLanguage || typeof targetLanguage !== 'string' || !targetLanguage.trim()) {
      return NextResponse.json(
        { error: 'targetLanguage_required', message: 'targetLanguage is required for LANGUAGE subjects (ISO 639-1 code, e.g. hi, fr, ta)' },
        { status: 400 },
      );
    }
  }

  const existing = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: { id: true, name: true, subjectType: true, targetLanguage: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 });
  }

  const updateData: { subjectType?: SubjectType; targetLanguage?: string | null } = {};
  if (subjectType !== undefined) updateData.subjectType = subjectType as SubjectType;
  if (subjectType === SubjectType.LANGUAGE) {
    updateData.targetLanguage = (targetLanguage as string).trim().toLowerCase();
  } else if (subjectType !== undefined) {
    // Clear targetLanguage when switching away from LANGUAGE type
    updateData.targetLanguage = null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.subjectDef.update({
      where: { id: subjectId },
      data: updateData,
    }),
    prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'SubjectDef',
        targetId: subjectId,
        action: AdminActionType.FEATURE_FLAG_CHANGE,
        previousValue: { subjectType: existing.subjectType, targetLanguage: existing.targetLanguage },
        newValue: updateData,
        reason: `Admin updated subject type/language for ${existing.name}`,
      },
    }),
  ]);

  logger.info('admin.subjectType.updated', {
    event: 'subject_type_change',
    context: { subjectId, subjectName: existing.name, ...updateData, adminId: session.user.id },
  });

  return NextResponse.json({ ok: true, subjectId, ...updateData });
}
