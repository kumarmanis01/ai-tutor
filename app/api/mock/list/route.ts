import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mock/list
 * Returns available mock exams for the authenticated student's grade/board/subjects.
 * Auth-guarded: 401 before any DB query.
 */
export async function GET(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id: string; grade?: string; board?: string } | undefined;

  if (!user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'MockListAPI', methodName: 'GET' }, start);
    return res;
  }

  // Fetch student profile for grade/board/subjects
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { grade: true, board: true, subjects: true },
  });

  const grade = profile?.grade ? Number(profile.grade) : null;
  const board = profile?.board ?? null;

  if (!grade || !board) {
    const res = NextResponse.json({ mocks: [] });
    logger.logAPI(req, res, { className: 'MockListAPI', methodName: 'GET' }, start);
    return res;
  }

  const mocks = await prisma.mockExam.findMany({
    where: { grade, board: { equals: board, mode: 'insensitive' }, status: 'active' },
    select: {
      id: true,
      title: true,
      totalMarks: true,
      durationMin: true,
      version: true,
      createdAt: true,
      subject: { select: { name: true } },
      _count: { select: { sections: true } },
    },
    orderBy: [{ subject: { name: 'asc' } }, { version: 'desc' }],
    take: 50,
  });

  // Attach attempt history for this student
  const attemptsByExam = await prisma.mockExamAttempt.groupBy({
    by: ['mockExamId'],
    where: { studentId: user.id, mockExamId: { in: mocks.map((m: any) => m.id) } },
    _max: { scorePercent: true, finishedAt: true },
    _count: { id: true },
  });

  const attemptMap = new Map<string, any>(attemptsByExam.map((a: any) => [a.mockExamId, a]));

  const result = mocks.map((m: any) => {
    const att = attemptMap.get(m.id);
    return {
      id: m.id,
      title: m.title,
      subjectName: m.subject.name,
      totalMarks: m.totalMarks,
      durationMin: m.durationMin,
      version: m.version,
      sectionCount: m._count.sections,
      attemptCount: att?._count.id ?? 0,
      bestScore: att?._max.scorePercent ?? null,
      lastAttemptAt: att?._max.finishedAt ?? null,
    };
  });

  const res = NextResponse.json({ mocks: result });
  logger.logAPI(req, res, { className: 'MockListAPI', methodName: 'GET' }, start);
  return res;
}
