/**
 * Progress report page -- /student/progress
 *
 * Server component. Never paywalled -- all students see this regardless of subscription.
 *
 * URL params:
 *   ?subject=<name>  -- filter chapter mastery + session history to one subject
 *   ?days=<7|30|90|0>  -- time window (0 = all time, default 30)
 *
 * Sections (top to bottom):
 *   0. Filter bar (ProgressFilters client component)
 *   1. AI Narrative Insight ("Vidya's insight") -- client widget, fetches independently
 *   2. Sessions Chart -- bucketed into 4 bars for the selected period
 *   3. Chapter Mastery Bars -- per subject (or single subject when filtered)
 *   4. Test Score History -- last 10 sessions in selected period
 *
 * Desktop layout (md:): left 60% = sections 1-2 | right 40% = sections 3-4
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 * - 2026-04-07 | claude | F-STU-033 AC-02: subject + time-range filters via URL params
 * - 2026-05-04 | copilot | apply subject filter to heatmap and concepts mastered count
 * - 2026-05-09T00:00:00Z | copilot | fix Gap 6 (PROGRESS_PAGE_GAP_AUDIT.md): replace generic subjectFilter
 *     with model-specific filter shapes for structuredSession (heatmap) and
 *     testResult/question (trend); deduplicate subjectNames on read (Gap 7)
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
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
import ProgressFilters from '@/components/student/progress/ProgressFilters';
import ScoreTrendGraph, { type TrendPoint } from '@/components/student/progress/ScoreTrendGraph';
import StudyTimeHeatmap, { type HeatmapDay } from '@/components/student/progress/StudyTimeHeatmap';
import { barConfig, buildBucketCounts } from '@/lib/student/progressReport';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Progress | Spinzy AI Tutor',
  description: 'Your learning journey at a glance.',
};

/** Estimate minutes per session (no explicit duration stored). */
const AVG_SESSION_MINUTES = 20;

export default async function ProgressPage({
  searchParams,
}: {
  searchParams?: { subject?: string; days?: string };
}) {
  const authSession = await requireActiveSession();
  if (!authSession) redirect('/');

  const userId = (authSession.user as { id: string }).id;

  // Parse filter params -- default 30 days, no subject filter.
  const rawDays = Number(searchParams?.days ?? 30);
  const days = [7, 30, 90, 0].includes(rawDays) ? rawDays : 30;
  const activeSubject = searchParams?.subject ?? '';

  const cfg = barConfig(days);
  const sinceDate = cfg.fetchDays > 0
    ? new Date(Date.now() - cfg.fetchDays * 24 * 60 * 60 * 1000)
    : null;

  // ── Parallel: student profile + chart sessions + completed sessions + trend ──
  const sessionDateFilter = sinceDate ? { gte: sinceDate } : undefined;

  // Gap 6 fix: structuredSession has no top-level 'subject' field.
  // Filter through topic → chapter → subject for heatmap queries.
  const sessionSubjectFilter = activeSubject
    ? { topic: { chapter: { subject: { name: { equals: activeSubject, mode: 'insensitive' as const } } } } }
    : {};

  // Gap 6 fix: Question model has no top-level 'subject' field.
  // When a subject filter is active, merge with { chapter: { not: null } } through chapter → subject.
  // When no filter is active, keep original { chapter: { not: null } } constraint.
  const questionClause = activeSubject
    ? { chapter: { not: null, subject: { name: { equals: activeSubject, mode: 'insensitive' as const } } } }
    : { chapter: { not: null } };

  const conceptSubjectFilter = activeSubject
    ? {
        concept: {
          topic: {
            chapter: {
              subject: { name: { equals: activeSubject, mode: 'insensitive' as const } },
            },
          },
        },
      }
    : {};

  const heatmapSince = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

  const [studentProfile, chartSessions, completedSessions, trendRows, heatmapSessions, conceptsMasteredCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { subjects: true },
    }),
    prisma.structuredSession.findMany({
      where: {
        studentId: userId,
        ...(sessionDateFilter ? { startedAt: sessionDateFilter } : {}),
      },
      select: { startedAt: true },
    }),
    prisma.structuredSession.findMany({
      where: {
        studentId: userId,
        completedAt: { not: null },
        ...(sessionDateFilter ? { completedAt: sessionDateFilter } : {}),
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
    // AC-07: last 10 chapter practice test scores, oldest-first for the trend graph.
    // A chapter practice test has at least one AttemptQuestion whose question has a
    // non-null chapter.  Subject filter applied when ?subject= param is set.
    prisma.testResult.findMany({
      where: {
        studentId: userId,
        score: { not: null },
        finishedAt: { not: null },
        AttemptQuestions: {
          some: {
            question: questionClause,
          },
        },
      },
      select: { score: true, finishedAt: true },
      orderBy: { finishedAt: 'asc' },
      take: 10,
    }),
    // AC-01 (F-STU-033): Time spent heatmap -- last 28 days, one row per session
    prisma.structuredSession.findMany({
      where: {
        studentId: userId,
        completedAt: { not: null, gte: heatmapSince },
        ...sessionSubjectFilter,
      },
      select: { startedAt: true, completedAt: true },
    }),
    // AC-01 (F-STU-033): Concepts mastered count (masteryScore > 0.75)
    prisma.studentConceptState.count({
      where: {
        studentId: userId,
        masteryScore: { gt: 0.75 },
        ...conceptSubjectFilter,
      },
    }),
  ]);

  // ── Subject defs ────────────────────────────────────────────────────────────
  // Gap 7 fix: deduplicate subjects on read to prevent duplicate subject cards.
  const subjectNames = [...new Set(
    (studentProfile?.subjects ?? []).map((s) => String(s)).filter(Boolean),
  )];
  const subjectDefs = subjectNames.length
    ? await prisma.subjectDef.findMany({
        where: {
          OR: [{ name: { in: subjectNames } }, { slug: { in: subjectNames } }],
          lifecycle: 'active',
        },
        select: { id: true, name: true },
      })
    : [];

  // Apply subject filter to the mastery query.
  const filteredSubjectDefs = activeSubject
    ? subjectDefs.filter(
        (s) => s.name.toLowerCase() === activeSubject.toLowerCase(),
      )
    : subjectDefs;

  // ── Readiness per subject (parallel, Redis-cached) ─────────────────────────
  const readinessResults = await Promise.all(
    filteredSubjectDefs.map((subj) => computeReadinessScore(userId, subj.id)),
  );

  // ── Weakest concept per chapter (for chapter row links) ────────────────────
  const allChapterIds = readinessResults.flatMap((r) => r.chapters.map((c) => c.chapterId));

  const chapterWeakestConceptMap = new Map<string, string>();
  const conceptsByChapter = new Map<string, string[]>();
  let memoryStrengthByConceptId = new Map<string, number>();

  if (allChapterIds.length > 0) {
    const concepts = await prisma.concept.findMany({
      where: { topic: { chapter: { id: { in: allChapterIds } } } },
      select: { id: true, topic: { select: { chapterId: true } } },
    });

    const allConceptIds = concepts.map((c) => c.id);
    const conceptStates = await prisma.studentConceptState.findMany({
      where: { studentId: userId, conceptId: { in: allConceptIds } },
      select: { conceptId: true, masteryScore: true, memoryStrength: true },
    });

    const masteryByConceptId = new Map<string, number>(
      conceptStates.map((s) => [s.conceptId, s.masteryScore]),
    );

    memoryStrengthByConceptId = new Map<string, number>(
      conceptStates.map((s) => [s.conceptId, (s as any).memoryStrength ?? 0]),
    );

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
        .sort(
          (a, b) =>
            (masteryByConceptId.get(a) ?? 0) - (masteryByConceptId.get(b) ?? 0),
        );
      chapterWeakestConceptMap.set(chapterId, sorted[0]);
      // compute average memoryStrength for the chapter
      const msVals = conceptIds.map((id) => memoryStrengthByConceptId.get(id) ?? 0);
      const _avgMs = msVals.length > 0 ? msVals.reduce((a, b) => a + b, 0) / msVals.length : 0;
      // store as a temporary map on chapterWeakestConceptMap via Map of maps? We'll attach later when assembling chapters.
    }
  }

  // ── Assemble subject mastery data ───────────────────────────────────────────
  const subjectMasteryData: SubjectMasteryData[] = filteredSubjectDefs.map((subj, idx) => {
    const readiness = readinessResults[idx];
    const chapters: ChapterRow[] = readiness.chapters
      .map((ch) => ({
        chapterId: ch.chapterId,
        chapterName: ch.chapterName,
        masteryScore: ch.masteryScore,
        boardWeightPct: ch.boardWeightPct,
        weakestConceptId: chapterWeakestConceptMap.get(ch.chapterId) ?? null,
        memoryStrength: (() => {
          const cIds = (conceptsByChapter.get(ch.chapterId) ?? [] as string[])
          const vals = cIds.map((id) => memoryStrengthByConceptId.get(id) ?? 0)
          return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
        })(),
      }))
      .sort((a, b) => a.masteryScore - b.masteryScore);

    return { subjectId: subj.id, subjectName: subj.name, chapters };
  });

  // ── Heatmap: aggregate minutes per calendar day (AC-01 F-STU-033) ───────────
  const minutesByDate = new Map<string, number>();
  for (const s of heatmapSessions) {
    if (!s.completedAt) continue;
    const dateKey = s.completedAt.toISOString().slice(0, 10);
    const durationMin = Math.max(0, Math.round((s.completedAt.getTime() - s.startedAt.getTime()) / 60_000));
    minutesByDate.set(dateKey, (minutesByDate.get(dateKey) ?? 0) + durationMin);
  }
  const heatmapDays: HeatmapDay[] = Array.from(minutesByDate.entries()).map(([date, minutes]) => ({ date, minutes }));

  // ── Chart ───────────────────────────────────────────────────────────────────
  const bucketCounts = buildBucketCounts(chartSessions, cfg, Date.now());
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

  // ── Chapter practice test trend (AC-07) ────────────────────────────────────
  const trendData: TrendPoint[] = trendRows.map((r) => ({
    date: r.finishedAt!.toISOString(),
    score: Math.round(r.score!),
  }));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">My Progress</h1>

      {/* Filter bar */}
      <div className="mb-6">
        <Suspense>
          <ProgressFilters
            subjects={subjectNames}
            activeSubject={activeSubject}
            activeDays={days}
          />
        </Suspense>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Left column -- narrative + chart (60%) */}
        <div className="flex flex-col gap-6 md:w-3/5">
          <AiNarrativeWidget />
          <SessionsChart
            weeklyCounts={bucketCounts}
            totalSessions={totalSessions}
            totalMinutes={totalMinutes}
            barLabels={cfg.labels}
            periodLabel={cfg.periodLabel}
          />
        </div>

        {/* Right column -- chapter mastery + session history (40%) */}
        <div className="flex flex-col gap-6 md:w-2/5">
          {/* AC-01 (F-STU-033): Concepts mastered count */}
          <article className="rounded-2xl border border-[#1D9E75]/30 bg-[#EAF3DE] dark:bg-[#1D9E75]/10 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1D9E75]">
                Concepts mastered
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-0.5">
                {conceptsMasteredCount}
              </p>
            </div>
            <svg
              className="w-8 h-8 text-[#1D9E75] opacity-70"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </article>
          <ChapterMasteryBars subjects={subjectMasteryData} />
          <TestScoreHistory sessions={sessionRows} />
          {/* AC-01 (F-STU-033): chapter practice test score trend */}
          <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
              Practice test trend
            </h2>
            <ScoreTrendGraph data={trendData} />
          </article>
          {/* AC-01 (F-STU-033): Time spent studying weekly heatmap */}
          <StudyTimeHeatmap days={heatmapDays} />
        </div>
      </div>
    </main>
  );
}
