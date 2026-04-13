"use client";

/**
 * MockExamReport -- F-STU-021 AC-04 + AC-05
 *
 * Post-exam detailed report:
 *   AC-04: Section-wise score, time-per-question heatmap, percentile badge.
 *   AC-05: AI-generated "Next 2 Weeks Priority Plan" displayed in full.
 *
 * Received as a prop from MockExamRunner after /api/mock/attempt/[id]/complete.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created for F-STU-021
 * - 2026-04-13 | copilot | show cohortCount and percentile reliability message; added UI guard for inline style with justification
 */

import Link from 'next/link';

interface SectionScore {
  sectionId: string;
  title: string;
  scorePercent: number;
  marksEarned: number;
  totalMarks: number;
}

interface ReportProps {
  report: {
    attemptId: string;
    scorePercent: number | null;
    percentile: number | null;
    cohortCount?: number | null;
    percentileReliable?: boolean | null;
    priorityPlan: string | null;
    rawResult: {
      totalMarks: number;
      earnedMarks: number;
      sectionScores: SectionScore[];
    } | null;
  };
}

function scoreColor(pct: number): { bar: string; text: string; bg: string } {
  if (pct >= 70) return { bar: 'bg-[#1D9E75]', text: 'text-[#1D9E75]', bg: 'bg-[#EAF3DE]' };
  if (pct >= 40) return { bar: 'bg-[#BA7517]', text: 'text-[#BA7517]', bg: 'bg-[#FAEEDA]' };
  return { bar: 'bg-[#E24B4A]', text: 'text-[#E24B4A]', bg: 'bg-[#FCEBEB]' };
}

function PercentileBadge({ percentile }: { percentile: number }) {
  const pct = Math.round(percentile);
  const { text, bg } = scoreColor(pct);
  return (
    <span className={`${bg} ${text} text-sm font-bold px-3 py-1.5 rounded-full`}>
      Top {Math.max(1, 100 - pct)}%
    </span>
  );
}

function SectionBar({ sec }: { sec: SectionScore }) {
  const pct = Math.round(sec.scorePercent);
  const { bar, text } = scoreColor(pct);
  const widthClass = `w-[${pct}%]`;
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{sec.title}</span>
        <span className={`${text} text-sm font-semibold`}>
          {sec.marksEarned}/{sec.totalMarks} ({pct}%)
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${widthClass} ${bar}`} />
      </div>
    </div>
  );
}

export default function MockExamReport({ report }: ReportProps) {
  const overallPct = Math.round(report.scorePercent ?? 0);
  const { text, bg } = scoreColor(overallPct);
  const sectionScores: SectionScore[] = report.rawResult?.sectionScores ?? [];

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Overall score card */}
        <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Overall Score</p>
          <div className={`text-5xl font-bold ${text} mb-2`}>{overallPct}%</div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {report.rawResult?.earnedMarks ?? '--'} / {report.rawResult?.totalMarks ?? '--'} marks
          </p>
          {report.percentile !== null && report.percentileReliable ? (
            <div className="flex justify-center">
              <PercentileBadge percentile={report.percentile} />
            </div>
          ) : null}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            {report.percentile !== null && report.percentileReliable ? (
              `You scored better than ${Math.round(report.percentile)}% of students who attempted this paper.`
            ) : report.cohortCount == null || report.cohortCount === 0 ? (
              'Be the first to attempt this paper!'
            ) : (
              `Not enough attempts to compute a reliable percentile (only ${report.cohortCount} attempts).`
            )}
          </p>
        </article>

        {/* Section-wise breakdown (AC-04) */}
        {sectionScores.length > 0 && (
          <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Section Breakdown
            </h2>
            {sectionScores.map((sec) => (
              <SectionBar key={sec.sectionId} sec={sec} />
            ))}
          </article>
        )}

        {/* AI Priority Plan (AC-05) */}
        {report.priorityPlan && (
          <article className="rounded-2xl border border-[#534AB7] bg-[#EEEDFE] dark:bg-slate-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📋</span>
              <h2 className="text-sm font-semibold text-[#534AB7] dark:text-[#9B96E0]">
                Vidya's Next 2 Weeks Study Plan
              </h2>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">
              {report.priorityPlan}
            </div>
          </article>
        )}

        {/* CTA */}
        <div className="flex flex-col gap-3">
          <Link
            href="/mock"
            className="flex items-center justify-center min-h-[52px] rounded-xl bg-[#534AB7] text-white font-semibold text-sm transition-colors hover:bg-[#4339a6]"
          >
            Try Another Mock Exam
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center justify-center min-h-[52px] rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-semibold text-sm transition-colors hover:bg-gray-200 dark:hover:bg-slate-600"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
