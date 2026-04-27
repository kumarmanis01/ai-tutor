"use client";
import { useEffect, useState } from 'react';

export type ParentModeStatus = { status: 'connected' | 'disconnected'; metrics?: { sessionsLastWeek?: number } };

export function useParentMode() {
  const [data, setData] = useState<ParentModeStatus>({ status: 'disconnected' });
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/parent-mode');
      const json = await res.json().catch(() => ({}));
      setData(json as ParentModeStatus);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return { data, loading, refresh };
}
