"use client";

/**
 * ProgressFilters -- subject + time-range filter bar for the progress report page.
 *
 * Pushes ?subject=<name>&days=<7|30|90|0> to the URL.
 * days=0 means "all time".
 *
 * Matches the wireframe: subject select + segmented period control.
 * Mobile-first: stacks on 360px, inline at sm+.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created for F-STU-033 AC-02
 * - 2026-05-29 | claude | redesign to match wireframe (hair-border select, pill segment)
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface ProgressFiltersProps {
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
    [router, searchParams],
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      {/* Subject filter */}
      {subjects.length > 1 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="subject-filter"
            className="text-[11px] font-medium text-[#888780] dark:text-[#6B7280] whitespace-nowrap uppercase tracking-wide"
          >
            Subject
          </label>
          <div className="relative">
            <select
              id="subject-filter"
              value={activeSubject}
              onChange={(e) => push(e.target.value, activeDays)}
              className="min-h-[38px] appearance-none rounded-lg border border-[#B4B2A9] dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-[#2C2C2A] dark:text-gray-100 pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-[#534AB7]"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#888780]"
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      )}

      {/* Time-range segmented control */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-[#888780] dark:text-[#6B7280] whitespace-nowrap uppercase tracking-wide">
          Period
        </span>
        <div
          className="inline-flex bg-white dark:bg-slate-800 border border-[#D3D1C7] dark:border-slate-600 rounded-lg p-[3px] gap-[2px]"
          role="group"
          aria-label="Time range"
        >
          {DAY_OPTIONS.map((opt) => {
            const isActive = activeDays === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => push(activeSubject, opt.value)}
                aria-pressed={isActive}
                className={[
                  'min-h-[32px] px-3 rounded-md text-[12px] font-medium transition-colors',
                  isActive
                    ? 'bg-[#534AB7] text-white'
                    : 'text-[#5F5E5A] dark:text-[#9AA6B2] hover:bg-page-bg dark:hover:bg-slate-700',
                ].join(' ')}
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
