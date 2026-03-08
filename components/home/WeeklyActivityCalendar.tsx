'use client';

import React from 'react';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface DayItem {
  date: string;
  completed: boolean;
}

interface WeeklyActivityCalendarProps {
  days: DayItem[];
  loading?: boolean;
}

/** Map JS getDay() (0=Sun, 1=Mon, ...) to Mon=0 .. Sun=6 */
function weekdayIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  return dow === 0 ? 6 : dow - 1;
}

/**
 * Last 7 days mapped to Mon–Sun: ● session completed, ○ no session.
 */
export function WeeklyActivityCalendar({ days, loading }: WeeklyActivityCalendarProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex justify-between gap-1">
          {DAY_LABELS.map((label) => (
            <div key={label} className="h-6 w-8 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const slots: boolean[] = Array(7).fill(false);
  for (const item of days) {
    const i = weekdayIndex(item.date);
    if (i >= 0 && i < 7 && item.completed) slots[i] = true;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className="flex flex-1 flex-col items-center gap-1"
            title={label}
          >
            <span className="text-xs text-muted-foreground">{label}</span>
            <span
              className="text-base leading-none text-foreground"
              aria-label={slots[i] ? `${label} completed` : `${label} no session`}
            >
              {slots[i] ? '●' : '○'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
