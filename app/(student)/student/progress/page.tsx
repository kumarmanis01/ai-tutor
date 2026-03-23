/**
 * Progress report page -- /student/progress
 *
 * Server component. Never paywalled -- all students see this regardless of subscription.
 *
 * Sections (top to bottom):
 *   1. AI Narrative Insight ("Vidya's insight") -- client widget, fetches independently
 *   2. Sessions Chart -- last 30 days grouped into 4 weeks, pure CSS bars
 *   3. Chapter Mastery Bars -- per subject, ordered lowest mastery first
 *   4. Test Score History -- last 10 completed sessions
 *
 * Desktop layout (md:): left 60% = sections 1-2 | right 40% = sections 3-4
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
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

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Progress | Spinzy AI Tutor',
  description: 'Your learning journey at a glance.',
};

/** Estimate minutes per session (no explicit duration stored). */
const AVG_SESSION_MINUTES = 20;

/** Group 30-day sessions into 4 weekly buckets (index 0 = oldest week). */
function buildWeeklyCounts(sessions: { startedAt: Date }[]): number[] {
  const counts = [0, 0, 0, 0];
  const now = Date.now();
  for (const s of sessions) {
    const daysAgo = Math.floor((now - s.startedAt.getTime()) / 86_400_000);
    const weekIdx = Math.min(3, Math.floor(daysAgo / 7)); // most recent = 0
    counts[3 - weekIdx]++; // reverse so index 0 = oldest
  }
  return counts;
}

export default async function ProgressPage() {
  const authSession = await requireActiveSession();
  if (!authSession) redirect('/');

  const userId = (authSession.user as { id: string }).id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // ── Parallel: student profile + chart sessions + completed sessions ─────────
  const [studentProfile, chartSessions, completedSessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { subjects: true },
    }),
    prisma.structuredSession.findMany({
      where: { studentId: userId, startedAt: { gte: thirtyDaysAgo } },
      select: { startedAt: true },
    }),
    prisma.structuredSession.findMany({
      where: { studentId: userId, completedAt: { not: null } },
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

  // ── Subject defs ────────────────────────────────────────────────────────────
  const subjectNames = (studentProfile?.subjects ?? []).map((s) => String(s)).filter(Boolean);
  const subjectDefs = subjectNames.length
    ? await prisma.subjectDef.findMany({
        where: {
          OR: [{ name: { in: subjectNames } }, { slug: { in: subjectNames } }],
          lifecycle: 'active',
        },
        select: { id: true, name: true },
      })
    : [];

  // ── Readiness per subject (parallel, Redis-cached) ─────────────────────────
  const readinessResults = await Promise.all(
    subjectDefs.map((subj) => computeReadinessScore(userId, subj.id)),
  );

  // ── Weakest concept per chapter (for chapter row links) ────────────────────
  const allChapterIds = readinessResults.flatMap((r) => r.chapters.map((c) => c.chapterId));

  const chapterWeakestConceptMap = new Map<string, string>();

  if (allChapterIds.length > 0) {
    const concepts = await prisma.concept.findMany({
      where: { topic: { chapter: { id: { in: allChapterIds } } } },
      select: { id: true, topic: { select: { chapterId: true } } },
    });

    const allConceptIds = concepts.map((c) => c.id);
    const conceptStates = await prisma.studentConceptState.findMany({
      where: { studentId: userId, conceptId: { in: allConceptIds } },
      select: { conceptId: true, masteryScore: true },
    });

    const masteryByConceptId = new Map<string, number>(
      conceptStates.map((s) => [s.conceptId, s.masteryScore]),
    );

    // Group concepts by chapterId
    const conceptsByChapter = new Map<string, string[]>();
    for (const c of concepts) {
      const chId = c.topic?.chapterId;
      if (!chId) continue;
      if (!conceptsByChapter.has(chId)) conceptsByChapter.set(chId, []);
      conceptsByChapter.get(chId)!.push(c.id);
    }

    // Find lowest-mastery concept per chapter
    for (const [chapterId, conceptIds] of conceptsByChapter) {
      if (conceptIds.length === 0) continue;
      const sorted = conceptIds
        .slice()
        .sort(
          (a, b) =>
            (masteryByConceptId.get(a) ?? 0) - (masteryByConceptId.get(b) ?? 0),
        );
      chapterWeakestConceptMap.set(chapterId, sorted[0]);
    }
  }

  // ── Assemble subject mastery data ───────────────────────────────────────────
  const subjectMasteryData: SubjectMasteryData[] = subjectDefs.map((subj, idx) => {
    const readiness = readinessResults[idx];
    const chapters: ChapterRow[] = readiness.chapters
      .map((ch) => ({
        chapterId: ch.chapterId,
        chapterName: ch.chapterName,
        masteryScore: ch.masteryScore,
        boardWeightPct: ch.boardWeightPct,
        weakestConceptId: chapterWeakestConceptMap.get(ch.chapterId) ?? null,
      }))
      .sort((a, b) => a.masteryScore - b.masteryScore); // lowest first

    return { subjectId: subj.id, subjectName: subj.name, chapters };
  });

  // ── Weekly chart ────────────────────────────────────────────────────────────
  const weeklyCounts = buildWeeklyCounts(chartSessions);
  const totalSessions = chartSessions.length;
  const totalMinutes = totalSessions * AVG_SESSION_MINUTES;

  // ── Session rows for test score table ───────────────────────────────────────
  const sessionRows: SessionRow[] = completedSessions.map((s) => {
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
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-6">My Progress</h1>

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
