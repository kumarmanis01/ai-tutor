export const dynamic = 'force-dynamic';

/**
 * GET /api/parent/learning-plan?studentId=xxx
 * Read-only: allow a parent to view their linked child's latest learning plan
 * summary (same shape as student-facing endpoint) but do not permit edits.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getNextConcept } from '@/lib/student/learningPlan';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';

const CACHE_TTL_S = 120;
const cacheKey = (studentId: string) => `lplan:v1:parent:${studentId}`;
const CLASS_NAME = 'ParentLearningPlanAPI';

export async function GET(req: NextRequest) {
  const start = Date.now();
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'parent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) return NextResponse.json({ error: 'studentId is required' }, { status: 400 });

    const parentId = session.user.id;

    // Verify active parent-child link
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (!link || link.status !== 'active') {
      return NextResponse.json({ error: 'Student not linked' }, { status: 403 });
    }

    // Check cache
    const cached = await cacheGet<object>(cacheKey(studentId));
    if (cached) {
      const resCached = NextResponse.json(cached);
      resCached.headers.set('X-Cache', 'HIT');
      logger.logAPI(req, resCached, { className: CLASS_NAME, methodName: 'GET' }, start);
      return resCached;
    }

    const plan = await prisma.learningPlan.findFirst({
      where: { studentId },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        subjectId: true,
        _count: { select: { items: true } },
        items: {
          where: { status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          take: 3,
          select: { conceptId: true, completedAt: true },
        },
      },
    });

    if (!plan) {
      const res = NextResponse.json(
        { planId: null, message: 'Diagnostic in progress' },
        { status: 202 }
      );
      logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'GET' }, start);
      return res;
    }

    const completedCount = await prisma.learningPlanItem.count({
      where: { planId: plan.id, status: 'COMPLETED' },
    });
    const totalConcepts = plan._count.items;
    const progressPercent =
      totalConcepts > 0 ? Math.round((completedCount / totalConcepts) * 100) : 0;

    const subject = await prisma.subjectDef.findUnique({
      where: { id: plan.subjectId },
      select: { name: true },
    });
    const subjectName = subject?.name ?? '';

    const nextConcept = await getNextConcept(studentId);
    const nextConceptPayload = nextConcept
      ? {
          conceptId: nextConcept.conceptId,
          conceptName: nextConcept.conceptName,
          chapterName: nextConcept.chapterName,
          masteryScore: nextConcept.masteryScore,
        }
      : null;

    const recentConceptIds = plan.items.map((i) => i.conceptId);
    const recentConcepts = recentConceptIds.length
      ? await prisma.concept.findMany({
          where: { id: { in: recentConceptIds } },
          select: { id: true, name: true },
        })
      : [];
    const conceptNameById = new Map(recentConcepts.map((c) => [c.id, c.name]));
    const recentlyCompleted = plan.items.map((item) => ({
      conceptName: conceptNameById.get(item.conceptId) ?? '',
      completedAt: item.completedAt ? item.completedAt.toISOString() : '',
    }));

    const payload = {
      planId: plan.id,
      subjectName,
      totalConcepts,
      completedConcepts: completedCount,
      progressPercent,
      nextConcept: nextConceptPayload,
      recentlyCompleted,
    };

    await cacheSet(cacheKey(studentId), payload, CACHE_TTL_S);

    const res = NextResponse.json(payload, { status: 200 });
    res.headers.set('X-Cache', 'MISS');
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('Parent learning-plan GET failed', { className: CLASS_NAME, error: String(err) });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
