/**
 * FILE OBJECTIVE:
 * - A1.1: POST /api/admin/content/flag-syllabus
 *   Flags a syllabus content item (ChapterDef, TopicDef, TopicNote, or GeneratedTest)
 *   by writing an AdminAuditLog entry. No ContentFlag model exists for syllabus items.
 *   Admin/moderator only.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content/flag-syllabus/route.spec.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin/guards';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type SyllabusItemType = 'chapter' | 'topic' | 'note' | 'test';

const VALID_TYPES: SyllabusItemType[] = ['chapter', 'topic', 'note', 'test'];

const VALID_REASONS = [
  'Inaccurate Content',
  'Inappropriate',
  'Duplicate',
  'Poor Quality',
  'Needs Revision',
  'Other',
] as const;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await requireActiveAdmin();
  if (!guard.ok) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid JSON' }, { status: 400 });
  }

  const { id, type, reason } = body as Record<string, unknown>;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'id is required' }, { status: 400 });
  }
  if (!type || !VALID_TYPES.includes(type as SyllabusItemType)) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'type must be one of: chapter, topic, note, test' }, { status: 400 });
  }
  if (!reason || !VALID_REASONS.includes(reason as typeof VALID_REASONS[number])) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid reason' }, { status: 400 });
  }

  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: guard.adminUserId,
        action: 'syllabus_content.flagged',
        targetType: type as string,
        targetId: id as string,
        details: { reason },
      },
    });

    logger.info('syllabus_content.flagged', {
      adminUserId: guard.adminUserId,
      type,
      id,
      reason,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    logger.error('flag-syllabus: POST failed', { error: err });
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed to flag item' }, { status: 500 });
  }
}
