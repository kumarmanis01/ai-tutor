export const dynamic = 'force-dynamic';

/**
 * FILE OBJECTIVE:
 * - Returns per-subject mastery for a linked student with:
 *   - Chapter-by-chapter breakdown (F-PAR-011 AC-01)
 *   - Top 3 strongest / bottom 3 weakest chapters with "AI working" flag (F-PAR-011 AC-01)
 *   - Predicted board mark range (F-PAR-011 AC-05)
 *   - Plain-language "What this means" tooltip (F-PAR-011 AC-03)
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-subject-mastery.spec.ts
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Parent Progress Dashboard
 * - 2026-04-14 | claude | added chapter breakdown, predicted marks, tooltip (F-PAR-011 AC-01/03/05)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { predictMarkRange, LOCAL_STRINGS } from '@/lib/parent/dashboardHelpers';
import type { AppSession } from '@/lib/types/auth';

const CLASS_NAME = 'ParentSubjectMasteryAPI';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChapterMastery {
  chapter: string;
  avgAccuracy: number; // 0-1
  topicCount: number;
  /** True when this chapter appears in the student's current UPCOMING learning plan */
  aiWorking: boolean;
}

interface SubjectMastery {
  subject: string;
  avgAccuracy: number;       // 0-1, rounded to 4 d.p.
  topicCount: number;
  /** Predicted board mark range [min, max] out of 100 (F-PAR-011 AC-05) */
  predictedMarkRange: [number, number];
  /** Plain-language tooltip for parent (F-PAR-011 AC-03) */
  masteryExplanation: string;
  /** All chapters sorted by avgAccuracy desc (F-PAR-011 AC-01) */
  chapters: ChapterMastery[];
  /** Top 3 strongest chapters (F-PAR-011 AC-01) */
  topStrengths: ChapterMastery[];
  /** Bottom 3 weakest chapters, with aiWorking=true (F-PAR-011 AC-01) */
  topWeaknesses: ChapterMastery[];
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/parent/subject-mastery?studentId=<id>&locale=en
 *
 * Response shape: SubjectMastery[]  -- one per subject attempted, alphabetical.
 */
export async function GET(req: NextRequest) {
  const start = Date.now();

  try {
    // 1. Auth
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const parentId = session.user.id;

    // 2. Input validation
    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }
    const locale = (req.nextUrl.searchParams.get('locale') ?? 'en') === 'hi' ? 'hi' : 'en';

    // 3. Parent-student link guard
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { status: true },
    });
    if (!link || link.status === 'revoked') {
      return NextResponse.json({ error: 'Student not linked' }, { status: 403 });
    }

    // 4. Fetch student info for grade (used in tooltip copy)
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { grade: true },
    });
    const gradeLabel = student?.grade ? `Class ${student.grade}` : 'their class';

    // 5. Per-subject aggregate (subject level)
    const subjectRows = await prisma.studentTopicMastery.groupBy({
      by: ['subject'],
      where: { studentId },
      _avg: { accuracy: true },
      _count: { topicId: true },
      orderBy: { subject: 'asc' },
    });

    if (subjectRows.length === 0) {
      logger.info('Parent subject mastery: no data yet', { className: CLASS_NAME, parentId, studentId });
      return NextResponse.json([]);
    }

    // 6. Chapter-level aggregate for all subjects in one query
    const chapterRows = await prisma.studentTopicMastery.groupBy({
      by: ['subject', 'chapter'],
      where: { studentId },
      _avg: { accuracy: true },
      _count: { topicId: true },
    });

    // 7. Find chapters currently in UPCOMING learning plan items
    //    (used to set aiWorking=true on weak chapters)
    const upcomingItems = await prisma.learningPlanItem.findMany({
      where: { plan: { studentId }, status: 'UPCOMING' },
      include: { concept: { select: { chapter: true } } },
    });
    const activeChapterNames = new Set<string>(
      upcomingItems
        .map((i) => (i.concept as any)?.chapter as string | undefined)
        .filter((c): c is string => Boolean(c))
    );

    // 8. Group chapter rows by subject
    const chaptersBySubject = new Map<string, ChapterMastery[]>();
    for (const row of chapterRows) {
      const cm: ChapterMastery = {
        chapter: row.chapter ?? 'Unknown',
        avgAccuracy: Math.round((row._avg.accuracy ?? 0) * 10_000) / 10_000,
        topicCount: row._count.topicId,
        aiWorking: activeChapterNames.has(row.chapter ?? ''),
      };
      const arr = chaptersBySubject.get(row.subject) ?? [];
      arr.push(cm);
      chaptersBySubject.set(row.subject, arr);
    }

    // 9. Build response
    const strings = LOCAL_STRINGS[locale] ?? LOCAL_STRINGS['en'];

    const result: SubjectMastery[] = subjectRows.map((r) => {
      const avgAccuracy = Math.round((r._avg.accuracy ?? 0) * 10_000) / 10_000;
      const masteryPct = Math.round(avgAccuracy * 100);
      const predictedMarkRange = predictMarkRange(masteryPct);

      const chapters = (chaptersBySubject.get(r.subject) ?? []).sort(
        (a, b) => b.avgAccuracy - a.avgAccuracy
      );

      // Bottom 3 are weaknesses; flag all bottom chapters as aiWorking regardless
      // of plan membership (the AI will be planning to address them).
      const topStrengths = chapters.slice(0, 3);
      const topWeaknesses = chapters
        .slice()
        .sort((a, b) => a.avgAccuracy - b.avgAccuracy)
        .slice(0, 3)
        .map((c) => ({ ...c, aiWorking: true }));

      // Plain-language explanation: "72% mastery means your child has solidly learned 72%
      // of the Class 10 Maths syllabus." (F-PAR-011 AC-03)
      const masteryExplanation =
        `${strings.whatThisMeansPrefix} ${masteryPct}% mastery means your child has solidly ` +
        `learned ${masteryPct}% of the ${gradeLabel} ${r.subject} syllabus.`;

      return {
        subject: r.subject,
        avgAccuracy,
        topicCount: r._count.topicId,
        predictedMarkRange,
        masteryExplanation,
        chapters,
        topStrengths,
        topWeaknesses,
      };
    });

    const response = NextResponse.json(result);

    logger.info('Parent subject mastery fetched', {
      className: CLASS_NAME,
      parentId,
      studentId,
      subjectCount: result.length,
    });

    logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'GET' }, start);
    return response;
  } catch (error) {
    logger.error('Failed to fetch parent subject mastery', { className: CLASS_NAME, error });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}
