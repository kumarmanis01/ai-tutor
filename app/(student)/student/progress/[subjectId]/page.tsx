/**
 * Per-subject progress page -- /student/progress/[subjectId]
 *
 * Server component. Linked from SubjectReadinessCard on the dashboard.
 * Shows the AI narrative, chapter mastery breakdown for this specific subject,
 * and session history filtered to sessions within that subject.
 *
 * Never paywalled -- all students see this.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | store weakest topicId per chapter; update ChapterRow to weakestTopicId
 * - 2026-03-15 | claude | created for Task 29 progress report page
 */

import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeReadinessScore } from '@/lib/student/examReadiness';
import AiNarrativeWidget from '@/components/student/progress/AiNarrativeWidget';
import SessionsChart from '@/components/student/progress/SessionsChart';
import ChapterMasteryBars, {
  type SubjectMasteryData,
  type ChapterRow,
} from '@/components/student/progress/ChapterMasteryBars';
import TestScoreHistory, {
  type SessionRow,
} from '@/components/student/progress/TestScoreHistory';
import Link from 'next/link';
import SubjectLanguageControl from '@/components/student/SubjectLanguageControl';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Subject Progress | Spinzy AI Tutor',
};

/** Estimate minutes per session (no explicit duration stored). */
const AVG_SESSION_MINUTES = 20;

interface Props {
  params: Promise<{ subjectId: string }>;
}

/** Group 30-day sessions into 4 weekly buckets (index 0 = oldest week). */
function buildWeeklyCounts(sessions: { startedAt: Date }[]): number[] {
  const counts = [0, 0, 0, 0];
  const now = Date.now();
  for (const s of sessions) {
    const daysAgo = Math.floor((now - s.startedAt.getTime()) / 86_400_000);
    const weekIdx = Math.min(3, Math.floor(daysAgo / 7));
    counts[3 - weekIdx]++;
  }
  return counts;
}

export default async function SubjectProgressPage({ params }: Props) {
  const { subjectId } = await params;

  const authSession = await requireActiveSession();
  if (!authSession) redirect('/');

  const userId = (authSession.user as { id: string }).id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // ── Subject def ─────────────────────────────────────────────────────────────
  const subjectDef = await prisma.subjectDef.findFirst({
    where: { id: subjectId, lifecycle: 'active' },
    select: { id: true, name: true },
  });

  if (!subjectDef) notFound();

  // ── Parallel: readiness + chart sessions + completed sessions for subject ───
  const [readiness, chartSessions, completedSessions] = await Promise.all([
    computeReadinessScore(userId, subjectId),
    prisma.structuredSession.findMany({
      where: {
        studentId: userId,
        startedAt: { gte: thirtyDaysAgo },
        topic: { chapter: { subjectId } },
      },
      select: { startedAt: true },
    }),
    prisma.structuredSession.findMany({
      where: {
        studentId: userId,
        completedAt: { not: null },
        topic: { chapter: { subjectId } },
      },
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        meta: true,
        topic: { select: { name: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    }),
  ]);

  // ── Weakest concept per chapter ─────────────────────────────────────────────
  const chapterIds = readiness.chapters.map((c) => c.chapterId);
  const chapterWeakestTopicMap = new Map<string, string>();

  if (chapterIds.length > 0) {
    const concepts = await prisma.concept.findMany({
      where: { topic: { chapter: { id: { in: chapterIds } } } },
      select: { id: true, topicId: true, topic: { select: { chapterId: true } } },
    });

    const conceptToTopicId = new Map<string, string>(
      concepts.map((c: any) => [c.id, c.topicId]),
    );

    const allConceptIds = concepts.map((c: any) => c.id);
    const conceptStates = await prisma.studentConceptState.findMany({
      where: { studentId: userId, conceptId: { in: allConceptIds } },
      select: { conceptId: true, masteryScore: true },
    });

    const masteryByConceptId = new Map<string, number>(
      conceptStates.map((s: any) => [s.conceptId, s.masteryScore]),
    );

    const conceptsByChapter = new Map<string, string[]>();
    for (const c of concepts) {
      const chId = c.topic?.chapterId;
      if (!chId) continue;
      if (!conceptsByChapter.has(chId)) conceptsByChapter.set(chId, []);
      conceptsByChapter.get(chId)!.push(c.id);
    }

    for (const [chapterId, conceptIds] of conceptsByChapter) {
      if (conceptIds.length === 0) continue;
      const sorted = conceptIds
        .slice()
        .sort((a, b) => (masteryByConceptId.get(a) ?? 0) - (masteryByConceptId.get(b) ?? 0));
      const weakestTopicId = conceptToTopicId.get(sorted[0]);
      if (weakestTopicId) chapterWeakestTopicMap.set(chapterId, weakestTopicId);
    }
  }

  // ── Assemble data ───────────────────────────────────────────────────────────
  const chapters: ChapterRow[] = readiness.chapters
    .map((ch) => ({
      chapterId: ch.chapterId,
      chapterName: ch.chapterName,
      masteryScore: ch.masteryScore,
      boardWeightPct: ch.boardWeightPct,
      weightSource: (ch as any).weightSource ?? 'estimated' as const,
      weakestTopicId: chapterWeakestTopicMap.get(ch.chapterId) ?? null,
    }))
    .sort((a, b) => a.masteryScore - b.masteryScore);

  const subjectMasteryData: SubjectMasteryData[] = [
    { subjectId: subjectDef.id, subjectName: subjectDef.name, chapters },
  ];

  const weeklyCounts = buildWeeklyCounts(chartSessions);
  const totalSessions = chartSessions.length;
  const totalMinutes = totalSessions * AVG_SESSION_MINUTES;

  const sessionRows: SessionRow[] = completedSessions.map((s: any) => {
    const meta = s.meta as Record<string, unknown> | null;
    const rawScore = meta?.score;
    return {
      id: s.id,
      date: s.completedAt!.toISOString(),
      topicName: s.topic?.name ?? 'Unknown topic',
      score: typeof rawScore === 'number' ? Math.round(rawScore) : null,
      durationMin: Math.max(
        0,
        Math.round((s.completedAt!.getTime() - s.startedAt.getTime()) / 60_000),
      ),
    };
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      {/* Back link */}
      <Link
        href="/student/progress"
        className="inline-flex items-center min-h-[44px] text-sm text-[#534AB7] dark:text-[#9B96E0] mb-4"
      >
        ← All subjects
      </Link>

      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-6">
        {subjectDef.name} -- Progress
      </h1>

      <div className="mb-4">
        <SubjectLanguageControl subjectId={subjectDef.id} />
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Left column -- narrative + chart (60%) */}
        <div className="flex flex-col gap-6 md:w-3/5">
          <AiNarrativeWidget />
          <SessionsChart
            weeklyCounts={weeklyCounts}
            totalSessions={totalSessions}
            totalMinutes={totalMinutes}
          />
        </div>

        {/* Right column -- chapter mastery + session history (40%) */}
        <div className="flex flex-col gap-6 md:w-2/5">
          <ChapterMasteryBars subjects={subjectMasteryData} />
          <TestScoreHistory sessions={sessionRows} />
        </div>
      </div>
    </main>
  );
}
