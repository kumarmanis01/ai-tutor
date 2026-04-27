"use client";
/**
 * FILE OBJECTIVE:
 * - Hook for fetching user streaks, goals, and learning progress metrics.
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useStreaksAndGoals.spec.ts
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | enhanced with progress metrics (tests, sessions, subjects)
 */
import { useEffect, useState, useCallback } from 'react';

export type Streak = { id: string; kind: string; current: number; best: number; updatedAt?: string };
export type Goals = { weeklyMinutes?: number; testsCompleted?: number };
export type Progress = {
  testsCompleted: number;
  averageScore: number;
  totalSessions: number;
  subjectsStudied: number;
  weeklyProgress: number; // percentage of weekly goal
};

export function useStreaksAndGoals() {
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [goals, setGoals] = useState<Goals>({});
  const [progress, setProgress] = useState<Progress>({
    testsCompleted: 0,
    averageScore: 0,
    totalSessions: 0,
    subjectsStudied: 0,
    weeklyProgress: 0,
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch streaks and progress in parallel
      const [streaksRes, progressRes] = await Promise.all([
        fetch('/api/dashboard/streaks'),
        fetch('/api/dashboard/progress'),
      ]);
      
      const streaksData = await streaksRes.json().catch(() => ({}));
      const items = Array.isArray(streaksData?.streaks) ? streaksData.streaks : [];
      setStreaks(items.map((s: any) => ({ 
        id: s.id, 
        kind: s.kind, 
        current: s.current ?? 0, 
        best: s.best ?? 0, 
        updatedAt: s.updatedAt 
      })));
      
      const progressData = await progressRes.json().catch(() => ({}));
      setProgress({
        testsCompleted: progressData.testsCompleted ?? 0,
        averageScore: progressData.averageScore ?? 0,
        totalSessions: progressData.totalSessions ?? 0,
        subjectsStudied: progressData.subjectsStudied ?? 0,
        weeklyProgress: progressData.weeklyProgress ?? 0,
      });
      
      setGoals({
        weeklyMinutes: progressData.weeklyGoalMinutes ?? 120,
        testsCompleted: progressData.weeklyTestsGoal ?? 5,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { streaks, goals, progress, loading, refresh };
}
