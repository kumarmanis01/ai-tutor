'use client';

/**
 * FILE OBJECTIVE:
 * - Small readiness card showing subject readiness percent and brief action hint.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/SubjectReadinessCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | added "What this means" tooltip and accessibility fixes
 */

import Link from 'next/link';

export interface SubjectReadinessCardProps {
  subjectName: string;
  score: number;
  subjectId: string;
  loading?: boolean;
  error?: boolean;
  /** True when the diagnostic has been submitted but readiness is not yet computed. */
  diagnosticDone?: boolean;
  predictedRange?: { low: number; high: number; confidenceLevel: number; daysUsed?: number | null };
  /**
   * ISO timestamp of when the diagnostic retake becomes available (30-day cooldown).
   * Non-null only during the cooldown window -- shows a "Retake opens on [date]" badge
   * so students know without navigating to the diagnostic page.
   */
  retakeEligibleAt?: string | null;
}

function ReadinessCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
      <div className="flex items-center gap-4">
        {/* Ring skeleton */}
        <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

type ColorConfig = { border: string; text: string; bar: string; label: string };

function getColorConfig(score: number): ColorConfig {
  if (score < 40) {
    return {
      border: 'border-[#E24B4A]',
      text: 'text-[#E24B4A]',
      bar: 'bg-[#E24B4A]',
      label: 'Critical',
    };
  }
  if (score <= 70) {
    return {
      border: 'border-[#BA7517]',
      text: 'text-[#BA7517]',
      bar: 'bg-[#BA7517]',
      label: 'Needs work',
    };
  }
  return {
    border: 'border-[#1D9E75]',
    text: 'text-[#1D9E75]',
    bar: 'bg-[#1D9E75]',
    label: 'On track',
  };
}

export function SubjectReadinessCard({
  subjectName,
  score,
  subjectId,
  loading = false,
  error = false,
  diagnosticDone = false,
  predictedRange,
  retakeEligibleAt,
}: SubjectReadinessCardProps) {
  if (loading) return <ReadinessCardSkeleton />;

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Couldn&apos;t load readiness</p>
      </div>
    );
  }

  // Empty state: score 0 = no data yet.
  // If the diagnostic has been submitted, show a "preparing" message instead of the CTA.
  if (score === 0) {
    if (diagnosticDone) {
      return (
        <div className="rounded-xl border border-[#1D9E75]/20 bg-[#EAF3DE] dark:border-[#1D9E75]/30 dark:bg-[#1D9E75]/10 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{subjectName}</p>
            <span className="text-xs font-medium text-[#1D9E75] dark:text-green-400">
              Diagnostic completed
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Readiness score is being calculated -- check back shortly.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{subjectName}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Take diagnostic to see readiness
        </p>
        <Link
          href="/student/onboarding/diagnostic"
          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#534AB7] text-white text-xs font-medium hover:bg-[#3C3489] transition-colors"
        >
          Start Diagnostic →
        </Link>
      </div>
    );
  }

  const { border, text, bar, label } = getColorConfig(score);

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
      <div className="flex items-center gap-4">
        {/* Score ring */}
        <div
          className={`flex-shrink-0 w-16 h-16 rounded-full border-4 ${border} flex flex-col items-center justify-center`}
          aria-label={`${subjectName} readiness: ${score}%`}
        >
          <span className={`text-base font-bold leading-none ${text}`}>{score}</span>
          <span className={`text-[9px] font-medium leading-tight ${text}`}>/ 100</span>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {subjectName}
            </p>
            {predictedRange && (
              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                Likely: {predictedRange.low}-{predictedRange.high} ({predictedRange.confidenceLevel}
                % CI)
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className={`flex-shrink-0 text-xs font-medium ${text}`}>{label}</span>
              <span
                className="text-2xs text-gray-400 hover:text-gray-500"
                title={
                  label === 'Critical'
                    ? 'What this means: Needs focused practice on earlier topics to catch up.'
                    : label === 'Needs work'
                      ? 'What this means: Regular practice will help improve readiness.'
                      : 'What this means: On track for upcoming assessments.'
                }
              >
                ⓘ
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
            role="progressbar"
            aria-label={`${subjectName} readiness progress`}
          >
            <div
              className={`h-full rounded-full ${bar} transition-all duration-300 ${
                score < 25 ? 'w-1/4' : score < 50 ? 'w-1/2' : score < 75 ? 'w-3/4' : 'w-full'
              }`}
            />
          </div>

          {/* Retake eligibility badge -- shown only during 30-day cooldown window */}
          {retakeEligibleAt && (
            <p className="mt-1.5 text-[10px] text-[#BA7517] dark:text-[#BA7517]/80 font-medium">
              Retake opens{' '}
              {new Date(retakeEligibleAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SubjectReadinessCard;
