/**
 * FILE OBJECTIVE:
 * - Aggregated skill/learning map shown after all enrollment diagnostics complete.
 * - Reads per-subject DiagnosticSession results from DB.
 * - Displays colour-banded chapter mastery for each subject (no numeric scores).
 * - "Go to dashboard" button ends the enrollment flow.
 *
 * EDIT LOG:
 * - 2026-05-05 | claude | created for post-enrollment skill map
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SoftDeleteStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

type MasteryBand = 'strong' | 'developing' | 'needs-work';

function masteryBand(score: number): MasteryBand {
  if (score >= 0.7) return 'strong';
  if (score >= 0.4) return 'developing';
  return 'needs-work';
}

const BAND_STYLES: Record<MasteryBand, { label: string; pill: string; bar: string }> = {
  'strong': {
    label: 'Strong',
    pill: 'bg-[#EAF3DE] text-[#1D9E75] dark:bg-[#1D9E75]/20 dark:text-[#4ade80]',
    bar: 'bg-[#1D9E75]',
  },
  'developing': {
    label: 'Developing',
    pill: 'bg-[#FAEEDA] text-[#BA7517] dark:bg-[#BA7517]/20 dark:text-[#fbbf24]',
    bar: 'bg-[#BA7517]',
  },
  'needs-work': {
    label: 'Needs work',
    pill: 'bg-[#FCEBEB] text-[#E24B4A] dark:bg-[#E24B4A]/20 dark:text-[#f87171]',
    bar: 'bg-[#E24B4A]',
  },
};

interface ChapterResult {
  chapterName: string;
  avgMastery: number;
  band: MasteryBand;
}

interface SubjectResult {
  subjectId: string;
  subjectName: string;
  chapters: ChapterResult[];
}

export default async function SkillMapPage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { board: true, grade: true, subjects: true, name: true },
  });

  if (!user?.board || !user?.grade) redirect('/enroll');

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

  const subjectResults: SubjectResult[] = [];

  for (const subject of subjectDefs) {
    const session = await prisma.diagnosticSession.findFirst({
      where: { studentId: userId, subjectId: subject.id, status: 'COMPLETED' },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) continue;

    const answers = await prisma.answerEvent.findMany({
      where: { sessionId: session.id, studentId: userId },
      select: {
        isCorrect: true,
        question: {
          select: {
            topic: {
              select: {
                chapter: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    // Aggregate per-chapter mastery
    const chapterMap = new Map<string, { name: string; correct: number; total: number }>();
    for (const a of answers) {
      const chapter = a.question?.topic?.chapter;
      if (!chapter) continue;
      const entry = chapterMap.get(chapter.id) ?? { name: chapter.name, correct: 0, total: 0 };
      entry.total++;
      if (a.isCorrect) entry.correct++;
      chapterMap.set(chapter.id, entry);
    }

    const chapters: ChapterResult[] = [];
    for (const [, ch] of chapterMap) {
      const avg = ch.total > 0 ? ch.correct / ch.total : 0.4;
      chapters.push({ chapterName: ch.name, avgMastery: avg, band: masteryBand(avg) });
    }
    chapters.sort((a, b) => a.avgMastery - b.avgMastery);

    if (chapters.length > 0) {
      subjectResults.push({ subjectId: subject.id, subjectName: subject.name, chapters });
    }
  }

  const firstName = user.name?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#EAF3DE] dark:bg-[#1D9E75]/20 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" className="w-8 h-8" aria-hidden>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Your learning map, {firstName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Here is where you stand across your subjects. Vidya will personalise your lessons based on this.
          </p>
        </div>

        {subjectResults.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              No diagnostic results yet. Complete at least one diagnostic to see your map.
            </p>
            <Link
              href="/enroll/diagnostic-queue"
              className="inline-flex items-center justify-center min-h-[44px] px-6 bg-[#534AB7] hover:bg-[#4840a3] text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Go to diagnostics
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {subjectResults.map((subject) => (
              <div key={subject.subjectId} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Subject header */}
                <div className="px-4 py-3 bg-[#EEEDFE] dark:bg-[#534AB7]/15 border-b border-[#534AB7]/10">
                  <h2 className="text-sm font-bold text-[#534AB7] dark:text-[#9d97e3]">
                    {subject.subjectName}
                  </h2>
                </div>

                {/* Chapter rows */}
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {subject.chapters.map((ch) => {
                    const style = BAND_STYLES[ch.band];
                    return (
                      <div
                        key={ch.chapterName}
                        className="flex items-center gap-3 px-4 min-h-[52px] py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug truncate">
                            {ch.chapterName}
                          </p>
                          {/* Mastery bar */}
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
            ))}

            {/* Legend */}
            <div className="flex flex-wrap gap-3 justify-center text-xs">
              {(Object.entries(BAND_STYLES) as [MasteryBand, typeof BAND_STYLES[MasteryBand]][]).map(([, s]) => (
                <span key={s.label} className={`px-2.5 py-1 rounded-full font-medium ${s.pill}`}>
                  {s.label}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-[#534AB7] hover:bg-[#4840a3] text-white font-semibold text-base transition-colors shadow-md shadow-[#534AB7]/25"
              >
                Start learning with Vidya →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
