import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/student/homework
 *
 * Returns all homework assignments for the authenticated student.
 * Automatically marks PENDING assignments past their dueDate as OVERDUE.
 */
export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const session = await getServerSessionForHandlers();
  const user = session?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'StudentHomeworkAPI', methodName: 'GET' }, start);
    return res;
  }

  const now = new Date();

  // Batch-update all PENDING assignments that are past due
  const { count: overdueCount } = await prisma.homeworkAssignment.updateMany({
    where: {
      studentId: user.id,
      status: 'PENDING',
      dueDate: { lt: now },
    },
    data: { status: 'OVERDUE' },
  });

  if (overdueCount > 0) {
    logger.info('[HOMEWORK_OVERDUE_DETECTED]', {
      studentId: user.id,
      overdueCount,
    });
  }

  const assignments = await prisma.homeworkAssignment.findMany({
    where: { studentId: user.id },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    include: {
      topic: { select: { name: true } },
      session: { select: { id: true } },
      _count: { select: { answers: true } },
    },
  });

  const items = assignments.map((a) => ({
    id: a.id,
    topicId: a.topicId,
    topicName: a.topic.name,
    sessionId: a.session?.id ?? null,
    status: a.status,
    score: a.score,
    dueDate: a.dueDate.toISOString(),
    answeredCount: a._count.answers,
    questionCount: Array.isArray(a.questions) ? (a.questions as unknown[]).length : 0,
    createdAt: a.createdAt.toISOString(),
  }));

  res = NextResponse.json({ homework: items });
  logger.logAPI(req, res, { className: 'StudentHomeworkAPI', methodName: 'GET' }, start);
  return res;
}
