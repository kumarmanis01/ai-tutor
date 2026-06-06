import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });

  try {
    const raw = req.nextUrl.searchParams.get('audience');
    let audience: { type: string; grade?: number; days?: number } = { type: 'all' };
    if (raw) {
      try { audience = JSON.parse(raw); } catch { /* use default */ }
    }

    let count = 0;

    if (audience.type === 'all') {
      count = await prisma.user.count({ where: { role: 'user' } });
    } else if (audience.type === 'grade' && audience.grade) {
      count = await prisma.user.count({
        where: { role: 'user', grade: String(audience.grade) },
      });
    } else if (audience.type === 'inactive' && audience.days) {
      const since = new Date(Date.now() - audience.days * 86_400_000);
      // Users with no LearningSession started in the past N days
      const activeStudentIds = await prisma.learningSession.findMany({
        where: { startedAt: { gte: since } },
        select: { studentId: true },
        distinct: ['studentId'],
      }).then((rows: any ) => rows.map((r: any ) => r.studentId));

      count = await prisma.user.count({
        where: { role: 'user', id: { notIn: activeStudentIds } },
      });
    }

    return NextResponse.json({ count });
  } catch (err) {
    logger.error('[notifications/audience-count] Failed', {
      event: 'audience_count_error',
      context: { error: String(err) },
    });
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed to count audience' }, { status: 500 });
  }
}
