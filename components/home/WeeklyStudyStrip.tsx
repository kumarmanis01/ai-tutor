/**
 * WeeklyStudyStrip
 *
 * A 7-day Mon–Sun activity strip showing which days the student had at least
 * one session. Absorbs streak and weekly session count display.
 *
 * Design rules (from UX architecture review):
 *   - Filled dot = had a session; empty dot = no session
 *   - No flames, no dramatic animations, no competitive language
 *   - Streak broken silently — never punish, never show broken state
 *   - Plain language below the strip
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created; replaces WeeklyProgress +
 *               StudyStreakCard + TodayGoal on dashboard
 */
'use client';

import React, { useEffect, useState } from 'react';

interface DayActivity {
  date: string;
  dayLabel: string;
  hasSession: boolean;
}

interface WeeklyStudyStripData {
  days: DayActivity[];
  sessionCountThisWeek: number;
  currentStreak: number;
}

export interface WeeklyStudyStripProps {
  /** Pre-loaded data (RSC). When undefined, component self-fetches. */
  data?: WeeklyStudyStripData;
}

export default function WeeklyStudyStrip({ data: initialData }: WeeklyStudyStripProps) {
  const [data, setData] = useState<WeeklyStudyStripData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) return; // already have data from RSC
    fetch('/api/student/weekly-activity')
      .then((r) => r.json())
      .then((d) => setData(d as WeeklyStudyStripData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initialData]);

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-gray-100" />
              <div className="h-3 w-6 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { days, sessionCountThisWeek, currentStreak } = data;

  // Compute today's index (Mon=0…Sun=6) to highlight today's dot
  const todayDow = new Date().getUTCDay();
  const todayIdx = todayDow === 0 ? 6 : todayDow - 1;

  const summaryText = (() => {
    if (sessionCountThisWeek === 0) return "You haven't studied this week yet. Start today.";
    if (currentStreak >= 2) return `You've studied ${currentStreak} days in a row.`;
    return `${sessionCountThisWeek} session${sessionCountThisWeek > 1 ? 's' : ''} this week.`;
  })();

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700">This Week</h3>

      {/* Day dots */}
      <div className="mt-3 flex justify-between">
        {days.map((day, i) => {
          const isToday = i === todayIdx;
          return (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  day.hasSession
                    ? 'bg-indigo-600'
                    : isToday
                    ? 'bg-gray-100 ring-2 ring-indigo-200'
                    : 'bg-gray-100'
                }`}
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
                  isToday ? 'text-indigo-600' : 'text-gray-400'
                }`}
              >
                {day.dayLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary text */}
      <p className="mt-3 text-sm text-gray-500">{summaryText}</p>
    </article>
  );
}
