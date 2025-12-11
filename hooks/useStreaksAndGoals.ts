"use client";
import { useEffect, useState } from 'react';

export type Streak = { id: string; kind: string; current: number; best: number; updatedAt?: string };
export type Goals = { weeklyMinutes?: number; testsCompleted?: number };

export function useStreaksAndGoals() {
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [goals, setGoals] = useState<Goals>({});
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/streaks');
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data?.streaks) ? data.streaks : [];
      setStreaks(items.map((s: any) => ({ id: s.id, kind: s.kind, current: s.current, best: s.best, updatedAt: s.updatedAt })));
      setGoals({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return { streaks, goals, loading, refresh };
}
