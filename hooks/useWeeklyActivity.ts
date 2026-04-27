'use client';
/**
 * FILE OBJECTIVE:
 * - Fetches which days this week had learning activity for the streak calendar.
 * - Calls /api/home/weekly-activity.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Gap #10 (visual streak calendar)
 */

import useSWR from 'swr';

export interface WeeklyActivity {
  activeDays: boolean[]; // 7 elements, index 0 = Monday
  todayIndex: number;    // 0–6
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useWeeklyActivity() {
  const { data, error, isLoading } = useSWR<WeeklyActivity>(
    '/api/home/weekly-activity',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  return {
    activeDays: data?.activeDays ?? Array(7).fill(false),
    todayIndex: data?.todayIndex ?? new Date().getDay(),
    loading: isLoading,
    error,
  };
}
