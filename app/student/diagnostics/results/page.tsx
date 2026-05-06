/**
 * FILE OBJECTIVE:
 * - Mastery results screen shown after all diagnostics + exam date are complete.
 * - Displays per-subject chapter mastery as colour bands (no numeric scores).
 * - Fires a one-time parent notification (email/WhatsApp) on first load.
 * - "Start Learning" CTA routes to /dashboard.
 *
 * EDIT LOG:
 * - 2026-05-06 | claude | created for diagnostics-status-screen task
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SoftDeleteStatus, DiagnosticStatus } from '@prisma/client';
import { notifyParent } from '@/lib/notifications/parentNotify';
import { PARENT_NOTIF_EVENTS } from '@/lib/constants/mail';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────────

type MasteryBand = 'strong' | 'developing' | 'needs-work';

interface ChapterResult {
  chapterName: string;
  avgMastery: number;
  band: MasteryBand;
}

interface SubjectResult {
  subjectId: string;
  subjectName: string;
  overallBand: MasteryBand;
  chapters: ChapterResult[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreToBand(score: number): MasteryBand {
  if (score >= 0.7) return 'strong';
  if (score >= 0.4) return 'developing';
  return 'needs-work';
}

const BAND_STYLES: Record<MasteryBand, { label: string; pill: string; bar: string; subjectBg: string }> = {
  strong: {
    label: 'Strong',
    pill: 'bg-[#EAF3DE] text-[#1D9E75] dark:bg-[#1D9E75]/20 dark:text-[#4ade80]',
    bar: 'bg-[#1D9E75]',
    subjectBg: 'bg-[#EAF3DE]/60 dark:bg-[#1D9E75]/10',
  },
  developing: {
    label: 'Developing',
    pill: 'bg-[#FAEEDA] text-[#BA7517] dark:bg-[#BA7517]/20 dark:text-[#fbbf24]',
    bar: 'bg-[#BA7517]',
    subjectBg: 'bg-[#FAEEDA]/60 dark:bg-[#BA7517]/10',
  },
  'needs-work': {
    label: 'Needs work',
    pill: 'bg-[#FCEBEB] text-[#E24B4A] dark:bg-[#E24B4A]/20 dark:text-[#f87171]',
    bar: 'bg-[#E24B4A]',
    subjectBg: 'bg-[#FCEBEB]/60 dark:bg-[#E24B4A]/10',
  },
};

// ── Notification guard (Redis, 7-day TTL) ─────────────────────────────────────

async function shouldSendNotification(userId: string): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) return true;
    const key = `diag_all_complete_notified:${userId}`;
    const existing = await redis.get(key);
    if (existing) return false;
    await redis.set(key, '1', 'EX', 7 * 24 * 60 * 60);
    return true;
  } catch {
    return false;
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DiagnosticsResultsPage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { board: true, grade: true, subjects: true, name: true },
  });

  if (!user?.board || !user?.grade) redirect('/student/onboarding');
  if (!user.subjects || user.subjects.length === 0) redirect('/dashboard');

  const gradeNum = Number(user.grade);

  const subjectDefs = await prisma.subjectDef.findMany({
    where: {
      lifecycle: SoftDeleteStatus.active,
      slug: { in: user.subjects },
      class: {
        grade: gradeNum,
        board: { slug: { equals: user.board, mode: 'insensitive' } },
      },
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  if (subjectDefs.length === 0) redirect('/dashboard');

  // Guard: only show if all subjects have completed diagnostics
  const completedSessions = await prisma.diagnosticSession.findMany({
    where: {
      studentId: userId,
      status: DiagnosticStatus.COMPLETED,
      subjectId: { in: subjectDefs.map((s) => s.id) },
    },
    select: { subjectId: true },
  });
  const completedSet = new Set(completedSessions.map((s) => s.subjectId));
  const allComplete = subjectDefs.every((s) => completedSet.has(s.id));
  if (!allComplete) redirect('/student/diagnostics');

  // Build per-subject mastery results
  const subjectResults: SubjectResult[] = [];

  for (const subject of subjectDefs) {
    const chapters = await prisma.chapterDef.findMany({
      where: { subjectId: subject.id, lifecycle: SoftDeleteStatus.active },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    });

    if (chapters.length === 0) continue;

    // Try concept states first (bootstrapped), fall back to AnswerEvents
    const conceptRows = await prisma.$queryRaw<{ chapterId: string; avg: number }[]>`
      SELECT t."chapterId", AVG(scs."masteryScore") AS avg
      FROM "StudentConceptState" scs
      JOIN "Concept" c ON c.id = scs."conceptId"
      JOIN "TopicDef" t ON t.id = c."topicId"
      WHERE scs."studentId" = ${userId}
        AND t."chapterId" = ANY(${chapters.map((c) => c.id)}::text[])
      GROUP BY t."chapterId"
    `;

    const chapterMasteryMap = new Map<string, number>(
      conceptRows.map((r) => [r.chapterId, Number(r.avg)])
    );

    // If no concept states, fall back to AnswerEvent accuracy per chapter
    if (chapterMasteryMap.size === 0) {
      const answerRows = await prisma.$queryRaw<{ chapterId: string; avg: number }[]>`
        SELECT t."chapterId",
               AVG(CASE WHEN ae."isCorrect" THEN 1.0 ELSE 0.0 END) AS avg
        FROM "AnswerEvent" ae
        JOIN "Question" q ON q.id = ae."questionId"
        JOIN "TopicDef" t ON t.id = q."topicId"
        WHERE ae."studentId" = ${userId}
          AND ae.source = 'diagnostic'
          AND t."chapterId" = ANY(${chapters.map((c) => c.id)}::text[])
        GROUP BY t."chapterId"
      `;
      for (const r of answerRows) {
        chapterMasteryMap.set(r.chapterId, Number(r.avg));
      }
    }

    const chapterResults: ChapterResult[] = chapters
      .filter((ch) => chapterMasteryMap.has(ch.id))
      .map((ch) => {
        const avg = chapterMasteryMap.get(ch.id)!;
        return { chapterName: ch.name, avgMastery: avg, band: scoreToBand(avg) };
      });

    if (chapterResults.length === 0) continue;

    const overallAvg = chapterResults.reduce((s, c) => s + c.avgMastery, 0) / chapterResults.length;

    subjectResults.push({
      subjectId: subject.id,
      subjectName: subject.name,
      overallBand: scoreToBand(overallAvg),
      chapters: chapterResults,
    });
  }

  // Send parent notification (once per student, guarded by Redis TTL)
  if (subjectResults.length > 0) {
    const send = await shouldSendNotification(userId);
    if (send) {
      const appUrl = (process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com').replace(/\/$/, '');
      const firstSubject = subjectResults[0];
      const overallBandLabel = BAND_STYLES[firstSubject.overallBand].label;
      void notifyParent(userId, {
        event: PARENT_NOTIF_EVENTS.DIAGNOSTIC_COMPLETE,
        data: {
          subjectName: subjectResults.map((s) => s.subjectName).join(', '),
          placement: overallBandLabel,
          dashboardUrl: `${appUrl}/dashboard`,
        },
      }).catch((err: unknown) => {
        logger.warn('[diagnostics/results] parent notify failed', {
          className: 'DiagnosticsResultsPage',
          userId,
          error: String((err as Error)?.message ?? err),
        });
      });
    }
  }

  const firstName = user.name?.split(' ')[0] ?? 'there';
  const noResults = subjectResults.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8">
      <div className="max-w-sm mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#EAF3DE] dark:bg-[#1D9E75]/20 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8" aria-hidden>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Your learning map, {firstName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Vidya will use this to personalise every lesson for you.
          </p>
        </div>

        {noResults ? (
          <div className="text-center py-8 mb-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Your results are being processed. This usually takes a moment.
            </p>
            <Link
              href="/student/diagnostics"
              className="inline-flex min-h-[44px] items-center justify-center px-6 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              Check back soon
            </Link>
          </div>
        ) : (
          <div className="space-y-5 mb-8">
            {subjectResults.map((subject) => {
              const headerStyle = BAND_STYLES[subject.overallBand];
              return (
                <div key={subject.subjectId} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  {/* Subject header */}
                  <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800 ${headerStyle.subjectBg}`}>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {subject.subjectName}
                    </h2>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${headerStyle.pill}`}>
                      {headerStyle.label}
                    </span>
                  </div>

                  {/* Chapter rows */}
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {subject.chapters.map((ch) => {
                      const style = BAND_STYLES[ch.band];
                      return (
                        <div key={ch.chapterName} className="flex items-center gap-3 px-4 min-h-[52px] py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug truncate">
                              {ch.chapterName}
                            </p>
                            {/* Progress bar (width encodes mastery, no number shown) */}
                            <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden w-full">
                              <div
                                className={`h-full rounded-full transition-all ${style.bar}`}
                                style={{ width: `${Math.round(ch.avgMastery * 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${style.pill}`}>
                            {style.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            <div className="flex flex-wrap gap-2 justify-center text-xs">
              {(Object.entries(BAND_STYLES) as [MasteryBand, typeof BAND_STYLES[MasteryBand]][]).map(([, s]) => (
                <span key={s.label} className={`px-2.5 py-1 rounded-full font-medium ${s.pill}`}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Parent notification notice */}
        <div className="flex items-start gap-3 bg-[#EEEDFE] dark:bg-[#534AB7]/10 rounded-xl px-4 py-3 mb-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 mt-0.5" aria-hidden>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <p className="text-xs text-[#534AB7] dark:text-indigo-300 leading-relaxed">
            Your parent has been notified about your diagnostic results via their preferred contact channel.
          </p>
        </div>

        {/* Start Learning CTA */}
        <Link
          href="/dashboard"
          className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#534AB7] hover:bg-[#4840a3] text-white font-bold text-base transition-colors shadow-md shadow-[#534AB7]/25"
        >
          Start learning with Vidya
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
