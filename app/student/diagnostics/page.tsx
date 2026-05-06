/**
 * FILE OBJECTIVE:
 * - Post-login diagnostic status screen.
 * - Fetches each enrolled subject's DiagnosticSession status.
 * - Completed subjects: show colour-banded mastery result + "View Results".
 * - Incomplete subjects: show "Start Now" link -> /diagnostic/[subjectId].
 * - When ALL subjects are done -> "See your results" CTA -> exam-date screen.
 * - When all done AND exam date already set -> redirect to results.
 *
 * EDIT LOG:
 * - 2026-05-06 | claude | created for diagnostics-status-screen task
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SoftDeleteStatus, DiagnosticStatus } from '@prisma/client';
import { getMasteryLabel } from '@/lib/learning/masteryLabel';

export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────────

type MasteryBand = 'strong' | 'developing' | 'needs-work';

interface SubjectCard {
  id: string;
  name: string;
  slug: string;
  completed: boolean;
  masteryBand: MasteryBand | null;
  masteryLabel: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function avgToMasteryBand(avg: number): MasteryBand {
  if (avg >= 0.7) return 'strong';
  if (avg >= 0.4) return 'developing';
  return 'needs-work';
}

const BAND_CONFIG: Record<MasteryBand, { pill: string; icon: string }> = {
  strong: {
    pill: 'bg-[#EAF3DE] text-[#1D9E75] dark:bg-[#1D9E75]/20 dark:text-[#4ade80]',
    icon: '#1D9E75',
  },
  developing: {
    pill: 'bg-[#FAEEDA] text-[#BA7517] dark:bg-[#BA7517]/20 dark:text-[#fbbf24]',
    icon: '#BA7517',
  },
  'needs-work': {
    pill: 'bg-[#FCEBEB] text-[#E24B4A] dark:bg-[#E24B4A]/20 dark:text-[#f87171]',
    icon: '#E24B4A',
  },
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DiagnosticsStatusPage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { board: true, grade: true, subjects: true, examDate: true, name: true },
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
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });

  if (subjectDefs.length === 0) redirect('/dashboard');

  // Completed diagnostic sessions
  const completedSessions = await prisma.diagnosticSession.findMany({
    where: {
      studentId: userId,
      status: DiagnosticStatus.COMPLETED,
      subjectId: { in: subjectDefs.map((s) => s.id) },
    },
    select: { subjectId: true },
  });
  const completedSet = new Set(completedSessions.map((s) => s.subjectId));

  // For completed subjects, compute avg mastery from concept states
  const completedSubjectIds = subjectDefs.filter((s) => completedSet.has(s.id)).map((s) => s.id);

  const masteryBySubject = new Map<string, number>();

  if (completedSubjectIds.length > 0) {
    const coveredSubjectIds = new Set<string>();

    // Direct query: avg masteryScore grouped by subjectId via concept -> topic chain
    const rows = await prisma.$queryRaw<{ subjectId: string; avg: number }[]>`
      SELECT c."subjectId", AVG(scs."masteryScore") AS avg
      FROM "StudentConceptState" scs
      JOIN "Concept" c ON c.id = scs."conceptId"
      WHERE scs."studentId" = ${userId}
        AND c."subjectId" = ANY(${completedSubjectIds}::text[])
      GROUP BY c."subjectId"
    `;

    for (const row of rows) {
      masteryBySubject.set(row.subjectId, Number(row.avg));
      coveredSubjectIds.add(row.subjectId);
    }

    // For subjects not yet bootstrapped, fall back to AnswerEvent accuracy
    const uncoveredIds = completedSubjectIds.filter((id) => !coveredSubjectIds.has(id));
    if (uncoveredIds.length > 0) {
      const answerRows = await prisma.$queryRaw<{ subjectId: string; avg: number }[]>`
        SELECT sd.id AS "subjectId",
               AVG(CASE WHEN ae."isCorrect" THEN 1.0 ELSE 0.0 END) AS avg
        FROM "AnswerEvent" ae
        JOIN "DiagnosticSession" ds ON ds.id = ae."sessionId"
        JOIN "SubjectDef" sd ON sd.id = ds."subjectId"
        WHERE ae."studentId" = ${userId}
          AND ds."studentId" = ${userId}
          AND ds.status = 'COMPLETED'
          AND sd.id = ANY(${uncoveredIds}::text[])
        GROUP BY sd.id
      `;
      for (const row of answerRows) {
        masteryBySubject.set(row.subjectId, Number(row.avg));
      }
    }
  }

  const allComplete = subjectDefs.every((s) => completedSet.has(s.id));

  // If all complete and exam date is already set, skip straight to results
  if (allComplete && user.examDate) {
    redirect('/student/diagnostics/results');
  }

  const cards: SubjectCard[] = subjectDefs.map((s) => {
    const completed = completedSet.has(s.id);
    const avg = masteryBySubject.get(s.id) ?? null;
    const band = avg !== null ? avgToMasteryBand(avg) : null;
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      completed,
      masteryBand: band,
      masteryLabel: avg !== null ? getMasteryLabel(avg) : null,
    };
  });

  const completedCount = cards.filter((c) => c.completed).length;
  const firstName = user.name?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8">
      <div className="max-w-sm mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#534AB7] flex items-center justify-center mb-4 shadow-md shadow-[#534AB7]/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden>
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {completedCount === 0
              ? `Hi ${firstName}, let's start your diagnostic`
              : allComplete
              ? `Well done, ${firstName}!`
              : `Keep going, ${firstName}`}
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {allComplete
              ? "You have completed all your diagnostics. Vidya is ready to personalise your plan."
              : completedCount === 0
              ? "A short diagnostic helps Vidya understand where you are in each subject."
              : `${completedCount} of ${cards.length} subjects done. Complete the rest to unlock your full plan.`}
          </p>
        </div>

        {/* Subject cards */}
        <div className="space-y-3 mb-8">
          {cards.map((card) => (
            <SubjectCard key={card.id} card={card} />
          ))}
        </div>

        {/* Bottom CTA */}
        {allComplete && !user.examDate && (
          <Link
            href="/student/diagnostics/exam-date"
            className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#534AB7] hover:bg-[#4840a3] text-white font-semibold text-base transition-colors shadow-md shadow-[#534AB7]/25"
          >
            See your results
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {!allComplete && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            Complete all diagnostics to unlock your personalised learning plan
          </p>
        )}
      </div>
    </div>
  );
}

// ── Sub-component: SubjectCard ─────────────────────────────────────────────────

function SubjectCard({ card }: { card: SubjectCard }) {
  if (card.completed && card.masteryBand) {
    const cfg = BAND_CONFIG[card.masteryBand];
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 min-h-[64px] py-3">
          {/* Checkmark */}
          <div className="shrink-0 w-10 h-10 rounded-xl bg-[#EAF3DE] dark:bg-[#1D9E75]/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{card.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Diagnostic complete</p>
          </div>
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.pill}`}>
            {card.masteryLabel}
          </span>
        </div>
      </div>
    );
  }

  if (card.completed) {
    // Completed but mastery not yet computed (bootstrap running)
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 min-h-[64px] py-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-[#EAF3DE] dark:bg-[#1D9E75]/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{card.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Processing results...</p>
          </div>
          <span className="shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500 px-2.5 py-1 bg-gray-100 dark:bg-slate-800 rounded-full">
            Done
          </span>
        </div>
      </div>
    );
  }

  // Not started
  return (
    <Link
      href={`/diagnostic/${card.id}`}
      className="block bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-[#534AB7]/50 hover:bg-[#EEEDFE]/30 dark:hover:bg-[#534AB7]/10 transition-all shadow-sm overflow-hidden group"
    >
      <div className="flex items-center gap-3 px-4 min-h-[64px] py-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-[#EEEDFE] dark:group-hover:bg-[#534AB7]/20 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 group-hover:stroke-[#534AB7] transition-colors" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{card.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Not started</p>
        </div>
        <span className="shrink-0 min-h-[36px] flex items-center px-4 rounded-xl bg-[#534AB7] text-white text-xs font-bold shadow-sm shadow-[#534AB7]/30">
          Start Now
        </span>
      </div>
    </Link>
  );
}
