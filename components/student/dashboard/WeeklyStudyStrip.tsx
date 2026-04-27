'use client';

/**
 * WeeklyStudyStrip -- v2
 *
 * 7-day Mon-Sun activity grid.
 *   - Filled purple (#534AB7) = session completed that day
 *   - Teal ring (#1D9E75)    = today
 *   - Grey                   = no session (future or past)
 * Below strip: "N of N sessions done · N days left" in muted text.
 * Goal driven by studentLearningProfile.studyDaysPerWeek (default 5).
 */

import React, { useEffect, useState } from 'react';

interface DayActivity {
  date: string;
  dayLabel: string;
  hasSession: boolean;
}

export interface WeeklyStudyStripData {
  days: DayActivity[];
  sessionCountThisWeek: number;
  currentStreak: number;
  weeklyGoal?: number;
}

export interface WeeklyStudyStripProps {
  /** Pre-loaded data from RSC. When absent, self-fetches. */
  data?: WeeklyStudyStripData;
}

export default function WeeklyStudyStrip({ data: initialData }: WeeklyStudyStripProps) {
  const [data, setData] = useState<WeeklyStudyStripData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) return;
    fetch('/api/student/weekly-activity')
      .then((r) => r.json())
      .then((d) => setData(d as WeeklyStudyStripData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initialData]);

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3">
        <div className="h-4 w-28 rounded bg-gray-200 dark:bg-slate-600" />
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700" />
              <div className="h-3 w-6 rounded bg-gray-100 dark:bg-slate-700" />
            </div>
          ))}
        </div>
        <div className="h-3 w-48 rounded bg-gray-100 dark:bg-slate-700" />
      </div>
    );
  }

  if (!data) return null;

  const { days, sessionCountThisWeek, weeklyGoal = 5 } = data;

  // Today's index (Mon=0 ... Sun=6)
  const todayDow = new Date().getUTCDay();
  const todayIdx = todayDow === 0 ? 6 : todayDow - 1;

  // Days left in week (counting today)
  const daysLeft = 7 - todayIdx;

  const footerText =
    `${sessionCountThisWeek} of ${weeklyGoal} sessions done · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;

  return (
    <article className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">This Week</h3>

      {/* Day dots grid */}
      <div className="flex justify-between">
        {days.map((day, i) => {
          const isToday = i === todayIdx;
          return (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
                  day.hasSession
                    ? 'bg-[#534AB7]'
                    : isToday
                    ? 'bg-gray-100 dark:bg-slate-700 ring-2 ring-[#1D9E75]'
                    : 'bg-gray-100 dark:bg-slate-700',
                ].join(' ')}
                aria-label={`${day.dayLabel}: ${day.hasSession ? 'studied' : 'no session'}${isToday ? ' (today)' : ''}`}
              >
                {day.hasSession && (
                  <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  isToday ? 'text-[#1D9E75]' : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {day.dayLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer goal text */}
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">{footerText}</p>
    </article>
  );
}
