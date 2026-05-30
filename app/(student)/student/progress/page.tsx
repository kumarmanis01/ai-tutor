/**
 * FILE OBJECTIVE:
 * - Render the student progress page and assemble mastery, trend, heatmap,
 *   and session history data for the selected subject and time range.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/progress/subjectFilter.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 * - 2026-04-07 | claude | F-STU-033 AC-02: subject + time-range filters via URL params
 * - 2026-05-04 | copilot | apply subject filter to heatmap and concepts mastered count
 * - 2026-05-09T00:00:00Z | copilot | fix Gap 6 (PROGRESS_PAGE_GAP_AUDIT.md): replace generic subjectFilter
 *     with model-specific filter shapes for structuredSession (heatmap) and
 *     testResult/question (trend); deduplicate subjectNames on read (Gap 7)
 * - 2026-05-10T00:00:00Z | copilot | normalize subject matching against slug/name and use read helper for filtered mastery
 * - 2026-05-17 | reviewer | restructure layout: 3-metric row, AI narrative, trend+heatmap grid,
 *                           chapter mastery, session history; remove SessionsChart; add formatMinutes + practiceAvg
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeReadinessScore } from '@/lib/student/examReadiness';
import AiNarrativeWidget from '@/components/student/progress/AiNarrativeWidget';
import HeroReadinessBand, { type HeroData } from '@/components/student/progress/HeroReadinessBand';
import ProgressMetricCard from '@/components/student/progress/ProgressMetricCard';
import { getRedis } from '@/lib/redis';
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
import { barConfig } from '@/lib/student/progressReport';
import { subjectDefMatchesActiveSubject } from '@/lib/student/progressPage';
import resolveStudentSubjects from '@/lib/subjects/resolveStudentSubjects';
import { getReadinessTier } from '@/lib/constants/readiness';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Progress | Spinzy AI Tutor',
  description: 'Your learning journey at a glance.',
};

/** Estimate minutes per session (no explicit duration stored). */
const AVG_SESSION_MINUTES = 20;

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams?: { subject?: string; days?: string } | Promise<{ subject?: string; days?: string } | undefined>;
}) {
  const authSession = await requireActiveSession();
  if (!authSession) redirect('/');

  const userId = (authSession.user as { id: string }).id;

  // Parse filter params -- Next.js 15 provides async searchParams (Promise).
  // Await it before accessing properties to avoid `sync-dynamic-apis` runtime error.
  const params = (await (searchParams as any)) ?? {};
  const parsedDays = Number.parseInt(String(params.days ?? '30'), 10);
  const rawDays = Number.isFinite(parsedDays) ? parsedDays : 30;
  const days = [7, 30, 90, 0].includes(rawDays) ? rawDays : 30;
  const activeSubject = typeof params.subject === 'string' ? params.subject : '';

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

  // Gap 6 fix (corrected): Question.chapter and Question.subject are both plain String?
  // fields -- not relations. The previous nested approach put 'subject' inside a
  // StringNullableFilter for 'chapter', which Prisma silently ignored. The correct
  // subject filter targets the top-level Question.subject string field.
  const questionClause = activeSubject
    ? { chapter: { not: null }, subject: { equals: activeSubject, mode: 'insensitive' as const } }
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
      select: { subjects: true, grade: true, board: true, currentStreak: true, longestStreak: true, lastSessionDate: true },
    }),
    prisma.structuredSession.findMany({
      where: {
        studentId: userId,
        ...(sessionDateFilter ? { startedAt: sessionDateFilter } : {}),
        ...sessionSubjectFilter,
      },
      select: { startedAt: true },
    }),
    prisma.structuredSession.findMany({
      where: {
        studentId: userId,
        // Merge not-null + optional date-range into a single DateTimeNullableFilter so the
        // spread cannot overwrite the not-null constraint when a date range is active.
        completedAt: {
          not: null,
          ...(sinceDate ? { gte: sinceDate } : {}),
        },
        ...sessionSubjectFilter,
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

  // ── Subject defs (via central resolver) ─────────────────────────────────────
  // resolveStudentSubjects handles grade+board scoping, unscoped fallback,
  // deduplication, and learningPlan ID fallback -- no bespoke logic needed.
  const subjectDefs = await resolveStudentSubjects(studentProfile, []);

  // Raw enrolled subject tokens for the filter bar. Using the user-stored tokens
  // (not just resolved names) ensures every enrolled subject appears as a filter
  // option even if it did not resolve to a SubjectDef (e.g. not yet seeded).
  const subjectNames = [...new Set(
    (studentProfile?.subjects ?? []).map((s) => String(s)).filter(Boolean),
  )];

  // Apply subject filter to the mastery query.
  const filteredSubjectDefs = activeSubject
    ? subjectDefs.filter((s) => subjectDefMatchesActiveSubject(s, activeSubject))
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

    // Normalize chapter id keys to strings so map lookups are consistent
    for (const c of concepts) {
      const rawChId = c.topic?.chapterId;
      const chId = rawChId ? String(rawChId) : '';
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
        // store with string key to match readiness.chapterId shape
        chapterWeakestConceptMap.set(String(chapterId), sorted[0]);
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
        weightSource: ch.weightSource,
        weakestConceptId: chapterWeakestConceptMap.get(String(ch.chapterId)) ?? null,
        memoryStrength: (() => {
          const cIds = (conceptsByChapter.get(String(ch.chapterId)) ?? [] as string[])
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

  // ── Totals ──────────────────────────────────────────────────────────────────
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

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const practiceAvg = trendData.length > 0
    ? Math.round(trendData.reduce((sum, p) => sum + p.score, 0) / trendData.length)
    : 0;

  // ── Overall readiness (avg across all subjects) ───────────────────────────
  const TIER_LABELS: Record<HeroData['tier'], string> = {
    critical: 'Critical',
    weak: 'Weak',
    fair: 'Fair',
    ontrack: 'On track',
    strong: 'Strong',
  };

  const allChaptersFlat = subjectMasteryData.flatMap((s) => s.chapters);
  const overallPct = allChaptersFlat.length > 0
    ? Math.round(allChaptersFlat.reduce((sum, c) => sum + c.masteryScore, 0) / allChaptersFlat.length * 100)
    : 0;
  const tier = getReadinessTier(overallPct);
  const strongestChapter = allChaptersFlat.length > 0
    ? [...allChaptersFlat].sort((a, b) => b.masteryScore - a.masteryScore)[0]?.chapterName ?? null
    : null;
  const weakestChapter = allChaptersFlat.length > 0
    ? allChaptersFlat[0]?.chapterName ?? null
    : null;

  // ── Week dots (last 7 days) ───────────────────────────────────────────────
  const activeDaysSet = new Set(
    heatmapSessions
      .filter((s) => s.completedAt)
      .map((s) => s.completedAt!.toISOString().slice(0, 10)),
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const weekDots: HeroData['weekDots'] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    if (key === todayKey) return activeDaysSet.has(key) ? 'done' : 'today';
    return activeDaysSet.has(key) ? 'done' : 'future';
  });

  const currentStreak = studentProfile?.currentStreak ?? 0;
  const bestStreak = studentProfile?.longestStreak ?? 0;

  // ── Grade label for hero headline ──────────────────────────────────────────
  const gradeLabel = studentProfile?.grade ? `Grade ${studentProfile.grade}` : '';
  const boardLabel = studentProfile?.board ?? '';
  const heroHeadline = overallPct > 0
    ? `You're ${TIER_LABELS[tier].toLowerCase()} for your${gradeLabel ? ` ${boardLabel} ${gradeLabel}` : ''} goals.`
    : `Start your first session to see your readiness here.`;
  const heroSummary = overallPct > 0 && weakestChapter
    ? `Focus on ${weakestChapter} to lift your overall score the most.`
    : `Complete sessions across your subjects to build your readiness profile.`;

  const heroData: HeroData = {
    overallPct,
    tier,
    tierLabel: TIER_LABELS[tier],
    headline: heroHeadline,
    summary: heroSummary,
    strongestChapter,
    weakestChapter,
    weekDots,
    currentStreak,
    bestStreak,
  };

  // ── Cached narrative ──────────────────────────────────────────────────────
  const cachedNarrative = await (async () => {
    try {
      const redis = getRedis();
      if (!redis) return null;
      const cached = await redis.get(`narrative:${userId}`);
      return cached ?? null;
    } catch {
      return null;
    }
  })();

  // ── Spark bar data for metric cards ──────────────────────────────────────
  const studySparkBars = heatmapSessions
    .filter((s) => s.completedAt)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .slice(-7)
    .map((s) => Math.max(1, Math.round((s.completedAt!.getTime() - s.startedAt.getTime()) / 60_000)));

  const scoreSparkBars = trendData.slice(-7).map((p) => p.score);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-page-bg dark:bg-background">
      <div className="max-w-6xl mx-auto px-4 pb-24">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-flex-end sm:justify-between pt-8 pb-5 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#888780] dark:text-[#6B7280]">
              Learning report
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#2C2C2A] dark:text-[#E6EEF8] mt-1.5 leading-none">
              My Progress
            </h1>
          </div>
          <Suspense>
            <ProgressFilters
              subjects={subjectNames}
              activeSubject={activeSubject}
              activeDays={days}
            />
          </Suspense>
        </div>

        {/* Hero readiness band */}
        <HeroReadinessBand data={heroData} />

        {/* 4-metric row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <ProgressMetricCard
            eyebrow="Concepts mastered"
            value={String(conceptsMasteredCount)}
            caption="mastery > 75%"
            highlight
            highlightColor="#1D9E75"
          />
          <ProgressMetricCard
            eyebrow="Study time"
            value={formatMinutes(totalMinutes)}
            caption={cfg.periodLabel}
            sparkBars={studySparkBars.length > 0 ? studySparkBars : undefined}
          />
          <ProgressMetricCard
            eyebrow="Practice average"
            value={practiceAvg > 0 ? `${practiceAvg}%` : '--'}
            caption={`Last ${trendData.length} tests`}
            sparkBars={scoreSparkBars.length > 0 ? scoreSparkBars : undefined}
          />
          <ProgressMetricCard
            eyebrow="Day streak"
            value={`${currentStreak}`}
            caption={`best ${bestStreak}`}
          />
        </div>

        {/* Vidya insight */}
        <div className="mb-6">
          <AiNarrativeWidget initialNarrative={cachedNarrative} />
        </div>

        {/* Trend + Heatmap */}
        <div className="grid grid-cols-1 md:grid-cols-[1.55fr_1fr] gap-6 mb-6">
          <div className="bg-white dark:bg-slate-900 border border-[#D3D1C7] dark:border-slate-700 rounded-2xl p-5">
            <div className="flex items-baseline justify-between gap-2 mb-4">
              <span className="text-base font-semibold tracking-tight text-[#2C2C2A] dark:text-[#E6EEF8]">
                Score trend
              </span>
              <span className="text-xs text-[#888780] dark:text-[#6B7280]">
                {cfg.periodLabel} · chapter practice tests
              </span>
            </div>
            <ScoreTrendGraph data={trendData} />
          </div>
          <div className="bg-white dark:bg-slate-900 border border-[#D3D1C7] dark:border-slate-700 rounded-2xl p-5">
            <div className="flex items-baseline justify-between gap-2 mb-4">
              <span className="text-base font-semibold tracking-tight text-[#2C2C2A] dark:text-[#E6EEF8]">
                Study time
              </span>
              <span className="text-xs text-[#888780] dark:text-[#6B7280]">Last 28 days</span>
            </div>
            <StudyTimeHeatmap days={heatmapDays} />
          </div>
        </div>

        {/* Chapter mastery */}
        <section className="mb-6">
          <h2 className="text-[17px] font-semibold tracking-tight text-[#2C2C2A] dark:text-[#E6EEF8] mb-3 flex items-baseline gap-2">
            Chapter mastery
            <span className="text-xs font-normal text-[#888780] dark:text-[#6B7280]">
              {activeSubject || 'All subjects'} &middot; weakest first
            </span>
          </h2>
          <ChapterMasteryBars subjects={subjectMasteryData} />
        </section>

        {/* Session history */}
        <section>
          <h2 className="text-[17px] font-semibold tracking-tight text-[#2C2C2A] dark:text-[#E6EEF8] mb-3 flex items-baseline gap-2">
            Session history
            <span className="text-xs font-normal text-[#888780] dark:text-[#6B7280]">Most recent</span>
          </h2>
          <TestScoreHistory sessions={sessionRows} />
        </section>
      </div>
    </main>
  );
}
