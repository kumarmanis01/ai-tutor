export const dynamic = 'force-dynamic';

/**
 * FILE OBJECTIVE:
 * - Returns per-subject mastery for a linked student with:
 *   - Chapter-by-chapter breakdown (F-PAR-011 AC-01)
 *   - Top 3 strongest / bottom 3 weakest chapters with "AI working" flag (F-PAR-011 AC-01)
 *   - Predicted board mark range (F-PAR-011 AC-05)
 *   - Plain-language "What this means" tooltip (F-PAR-011 AC-03)
 *   - Predicted days to 80% readiness at current pace (F-PAR-012 AC-05)
 *   - Anonymous peer percentile when benchmarking=true (F-PAR-011 AC-04)
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-subject-mastery.spec.ts
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Parent Progress Dashboard
 * - 2026-04-14 | claude | chapter breakdown, predicted marks, tooltip (F-PAR-011 AC-01/03/05)
 * - 2026-04-14 | claude | readiness prediction + peer benchmarking (F-PAR-012 AC-05, F-PAR-011 AC-04)
 * - 2026-04-14T12:00:00Z | staff-engineer | fix: require active link; batch peer benchmarking query; correct aiWorking flag
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import {
  predictMarkRange,
  predictDaysToReadiness,
  LOCAL_STRINGS,
  PLATFORM_DEFAULT_GAIN_PER_SESSION,
} from '@/lib/parent/dashboardHelpers';
import type { AppSession } from '@/lib/types/auth';

const CLASS_NAME = 'ParentSubjectMasteryAPI';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChapterMastery {
  chapter: string;
  avgAccuracy: number; // 0-1
  topicCount: number;
  aiWorking: boolean;
}

interface SubjectMastery {
  subject: string;
  avgAccuracy: number;
  topicCount: number;
  predictedMarkRange: [number, number];
  masteryExplanation: string;
  chapters: ChapterMastery[];
  topStrengths: ChapterMastery[];
  topWeaknesses: ChapterMastery[];
  /** Predicted days to reach 80% readiness at current pace (F-PAR-012 AC-05). null when pace unknown. */
  predictedDaysTo80: number | null;
  /** Predicted date string (ISO) when predictedDaysTo80 is known */
  predictedReadyByDate: string | null;
  /** Peer percentile (0-100): % of same-grade students with lower mastery. null when benchmarking=false */
  peerPercentile: number | null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/parent/subject-mastery?studentId=<id>&locale=en&benchmarking=true
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

    // 2. Input
    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }
    const locale = req.nextUrl.searchParams.get('locale') === 'hi' ? 'hi' : 'en';
    const benchmarking = req.nextUrl.searchParams.get('benchmarking') === 'true';

    // 3. Parent-student link guard
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { status: true },
    });
    // Require an active link; pending or revoked links must not expose student mastery data.
    if (!link || link.status !== 'active') {
      return NextResponse.json({ error: 'Student not linked' }, { status: 403 });
    }

    // 4. Student grade (used in tooltip copy and peer benchmarking)
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { grade: true },
    });
    const gradeLabel = student?.grade ? `Class ${student.grade}` : 'their class';

    // 5. Subject-level aggregate
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

    // 6. Chapter-level aggregate
    const chapterRows = await prisma.studentTopicMastery.groupBy({
      by: ['subject', 'chapter'],
      where: { studentId },
      _avg: { accuracy: true },
      _count: { topicId: true },
    });

    // 7. Active UPCOMING plan chapters (for aiWorking flag)
    const upcomingItems = await prisma.learningPlanItem.findMany({
      where: { plan: { studentId }, status: 'UPCOMING' },
      include: { concept: { select: { chapter: true } } },
    });
    const activeChapterNames = new Set<string>(
      upcomingItems
        .map((i) => (i.concept as any)?.chapter as string | undefined)
        .filter((c): c is string => Boolean(c))
    );

    // 8. Readiness status per subject (for pace prediction, F-PAR-012 AC-05)
    const readinessRows = await prisma.readinessStatus.findMany({
      where: { studentId },
      select: { subject: true, readinessScore: true },
    });
    const readinessBySubject = new Map(readinessRows.map((r) => [r.subject, r.readinessScore]));

    // 9. Average weekly sessions over last 4 weeks (for pace prediction)
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const weeklySummaries = await prisma.weeklyStudentSummary.findMany({
      where: { studentId, weekStart: { gte: fourWeeksAgo } },
      select: { sessionsCount: true },
    });
    const totalSessions = weeklySummaries.reduce((s, w) => s + w.sessionsCount, 0);
    // Use number of completed weeks (1-4) as denominator so early students get fair estimate
    const completedWeeks = Math.max(1, weeklySummaries.length);
    const avgWeeklySessions = totalSessions / completedWeeks;

    // 10. Peer benchmarking (F-PAR-011 AC-04) -- only when opt-in requested
    //     Count students in same grade with lower avg accuracy per subject.
    //     Done in one query per subject when benchmarking=true.
    const peerPercentileBySubject = new Map<string, number>();
    if (benchmarking && student?.grade) {
      // Optimize benchmarking by fetching peer averages for all subjects in a single query
      const subjects = subjectRows.map((sr) => sr.subject);
      if (subjects.length > 0) {
        const peers = await prisma.studentTopicMastery.groupBy({
          by: ['subject', 'studentId'],
          where: {
            subject: { in: subjects },
            student: { grade: student.grade },
          },
          _avg: { accuracy: true },
        });

        const peersBySubject = new Map<string, number[]>();
        for (const p of peers) {
          const arr = peersBySubject.get(p.subject) ?? [];
          arr.push(p._avg.accuracy ?? 0);
          peersBySubject.set(p.subject, arr);
        }

        for (const sr of subjectRows) {
          const subjectAvg = sr._avg.accuracy ?? 0;
          const arr = peersBySubject.get(sr.subject) ?? [];
          if (arr.length > 1) {
            const below = arr.filter((a) => a < subjectAvg).length;
            peerPercentileBySubject.set(sr.subject, Math.round((below / (arr.length - 1)) * 100));
          }
        }
      }
    }

    // 11. Group chapter rows by subject
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

    // 12. Build response
    const strings = LOCAL_STRINGS[locale] ?? LOCAL_STRINGS['en'];
    const now = new Date();

    const result: SubjectMastery[] = subjectRows.map((r) => {
      const avgAccuracy = Math.round((r._avg.accuracy ?? 0) * 10_000) / 10_000;
      const masteryPct = Math.round(avgAccuracy * 100);
      const predictedMarkRange = predictMarkRange(masteryPct);

      const chapters = (chaptersBySubject.get(r.subject) ?? []).sort(
        (a, b) => b.avgAccuracy - a.avgAccuracy
      );
      const topStrengths = chapters.slice(0, 3);
      const topWeaknesses = chapters
        .slice()
        .sort((a, b) => a.avgAccuracy - b.avgAccuracy)
        .slice(0, 3)
        .map((c) => ({ ...c, aiWorking: activeChapterNames.has(c.chapter) }));

      const masteryExplanation =
        `${strings.whatThisMeansPrefix} ${masteryPct}% mastery means your child has solidly ` +
        `learned ${masteryPct}% of the ${gradeLabel} ${r.subject} syllabus.`;

      // Readiness pace prediction (F-PAR-012 AC-05)
      const currentReadiness = readinessBySubject.get(r.subject) ?? masteryPct;
      const prediction = predictDaysToReadiness(
        currentReadiness,
        80,
        avgWeeklySessions,
        PLATFORM_DEFAULT_GAIN_PER_SESSION,
      );

      let predictedDaysTo80: number | null = null;
      let predictedReadyByDate: string | null = null;
      if (prediction.feasible && prediction.estimatedDays !== null) {
        predictedDaysTo80 = prediction.estimatedDays;
        const targetDate = new Date(now.getTime() + predictedDaysTo80 * 24 * 60 * 60 * 1000);
        predictedReadyByDate = targetDate.toISOString().slice(0, 10);
      }

      return {
        subject: r.subject,
        avgAccuracy,
        topicCount: r._count.topicId,
        predictedMarkRange,
        masteryExplanation,
        chapters,
        topStrengths,
        topWeaknesses,
        predictedDaysTo80,
        predictedReadyByDate,
        peerPercentile: benchmarking ? (peerPercentileBySubject.get(r.subject) ?? null) : null,
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
