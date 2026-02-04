'use client';
/**
 * FILE OBJECTIVE:
 * - Hook for fetching pending recovery nudge from FRS.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created useRecoveryNudge hook for FRS integration
 */

import { useState, useEffect, useCallback } from 'react';

export interface RecoveryNudge {
  nudgeType: 'gentle_nudge' | 'easy_task' | 'fresh_start';
  message: string;
  inactiveDays: number;
  dailyTaskId: string | null;
}

export function useRecoveryNudge() {
  const [nudge, setNudge] = useState<RecoveryNudge | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchNudge = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/recovery');
      if (res.ok) {
        const data = await res.json();
        setNudge(data.nudge ?? null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNudge();
  }, [fetchNudge]);

  const respond = useCallback(async () => {
    try {
      await fetch('/api/dashboard/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'respond' }),
      });
      setNudge(null);
    } catch {
      // silent
    }
  }, []);

  const dismiss = useCallback(async (eventId: string) => {
    try {
      await fetch('/api/dashboard/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', eventId }),
      });
      setNudge(null);
    } catch {
      // silent
    }
  }, []);

  return { nudge, loading, respond, dismiss, refresh: fetchNudge };
}
