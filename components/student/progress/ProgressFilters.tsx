'use client';

/**
 * ProgressFilters -- subject + time-range filter bar for the progress report page.
 *
 * Pushes `?subject=<name>&days=<7|30|90|0>` to the URL.  The server component
 * (page.tsx) reads these params and re-renders with filtered data.
 *
 * days=0 means "all time".
 *
 * Mobile-first: stacks vertically on 360px, inline on sm+.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created for F-STU-033 AC-02
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface ProgressFiltersProps {
  /** Subject names the student is enrolled in. */
  subjects: string[];
  activeSubject: string;
  activeDays: number;
}

const DAY_OPTIONS: { label: string; value: number }[] = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: 'All time', value: 0 },
];

export default function ProgressFilters({
  subjects,
  activeSubject,
  activeDays,
}: ProgressFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const push = useCallback(
    (subject: string, days: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (subject) {
        params.set('subject', subject);
      } else {
        params.delete('subject');
      }
      params.set('days', String(days));
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      {/* Subject filter -- only shown when student studies multiple subjects */}
      {subjects.length > 1 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="subject-filter"
            className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
          >
            Subject
          </label>
          <select
            id="subject-filter"
            value={activeSubject}
            onChange={(e) => push(e.target.value, activeDays)}
            className="min-h-[44px] rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-gray-800 dark:text-gray-100 px-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Time-range buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
          Period
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {DAY_OPTIONS.map((opt) => {
            const isActive = activeDays === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => push(activeSubject, opt.value)}
                className={[
                  'min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#534AB7] text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600',
                ].join(' ')}
                aria-pressed={isActive}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
