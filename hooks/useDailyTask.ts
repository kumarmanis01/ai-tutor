'use client';
/**
 * FILE OBJECTIVE:
 * - SWR hook for fetching and managing the student's daily task from DHE.
 * - Provides get, complete, and skip actions.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created useDailyTask hook for DHE integration
 */

import { useState, useEffect, useCallback } from 'react';

export interface DailyTask {
  id: string;
  date: string;
  taskType: 'learn' | 'practice' | 'revise' | 'fix_gap' | 'confidence';
  title: string;
  description: string | null;
  topicId: string | null;
  subject: string | null;
  chapter: string | null;
  steps: { label: string; done: boolean }[] | null;
  estimatedTimeMin: number;
  status: 'pending' | 'completed' | 'skipped' | 'expired';
  completedAt: string | null;
  skippedAt: string | null;
  motivationMessage: string | null;
  isRecoveryTask: boolean;
}

export function useDailyTask() {
  const [task, setTask] = useState<DailyTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/daily-task');
      if (!res.ok) {
        setError('Failed to load daily task');
        return;
      }
      const data = await res.json();
      setTask(data.task ?? null);
      setError(null);
    } catch {
      setError('Failed to load daily task');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const completeTask = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      if (res.ok) {
        const data = await res.json();
        setTask(data.task ?? null);
      }
    } catch {
      // silent fail
    }
  }, []);

  const skipTask = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      });
      if (res.ok) {
        const data = await res.json();
        setTask(data.task ?? null);
      }
    } catch {
      // silent fail
    }
  }, []);

  return { task, loading, error, refresh: fetchTask, completeTask, skipTask };
}
