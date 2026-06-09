/**
 * FILE OBJECTIVE:
 * - GET /api/admin/concepts: returns a grouped coverage summary of all TopicConcept rows,
 *   useful for the admin concept seeder page to show what has already been seeded.
 *   DELETE /api/admin/concepts: deletes all TopicConcept rows for a given board/grade/subject/topicSlug.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | add Zod validation to DELETE handler
 * - 2026-06-09T00:00:00Z | claude | initial implementation for admin concept seeder
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { DeleteConceptsSchema } from '@/lib/validators/concepts';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  const rows = await prisma.topicConcept.groupBy({
    by: ['board', 'grade', 'subject', 'topicSlug'],
    _count: { id: true },
    orderBy: [{ board: 'asc' }, { grade: 'asc' }, { subject: 'asc' }, { topicSlug: 'asc' }],
  });

  const coverage = rows.map((r: typeof rows[number]) => ({
    board: r.board,
    grade: r.grade,
    subject: r.subject,
    topicSlug: r.topicSlug,
    count: r._count.id,
  }));

  return NextResponse.json({ coverage });
}

export async function DELETE(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = DeleteConceptsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { board, grade, subject, topicSlug } = parsed.data;

  const result = await prisma.topicConcept.deleteMany({
    where: { board, grade, subject, topicSlug },
  });

  logger.info('admin.concepts.deleted', { board, grade, subject, topicSlug, count: result.count });

  return NextResponse.json({ ok: true, deleted: result.count });
}
