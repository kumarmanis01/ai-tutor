"use client";
import { useEffect, useState } from 'react';

export type ContinueActivity = {
  id: string;
  activityType: string; // 'test' | 'notes' | 'practice' | 'doubt_solving'
  subject?: string;
  contentId?: string;
  startedAt?: string;
  endedAt?: string | null;
  meta?: any;
};

export function useContinueLearning() {
  const [activities, setActivities] = useState<ContinueActivity[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/continue-learning');
      const data = await res.json().catch(() => ({}));
      setActivities(Array.isArray(data?.activities) ? data.activities : []);
    } finally {
      setLoading(false);
    }
  }

  function resumeActivity(a: ContinueActivity) {
    const id = a.contentId || a.id;
    if (a.activityType === 'test') {
      window.location.assign(`/tests?resume=${encodeURIComponent(id)}`);
    } else if (a.activityType === 'notes') {
      window.location.assign(`/notes?noteId=${encodeURIComponent(id)}`);
    } else if (a.activityType === 'practice') {
      window.location.assign(`/tests?practice=${encodeURIComponent(id)}`);
    } else if (a.activityType === 'doubt_solving') {
      window.location.assign(`/rooms?resume=${encodeURIComponent(id)}`);
    } else {
      window.location.assign('/');
    }
  }

  useEffect(() => { refresh(); }, []);

  return { activities, loading, refresh, resumeActivity };
}
