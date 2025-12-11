"use client";
import { useEffect, useState } from 'react';

export type ContinueActivity = {
  id: string;
  activityType: string;
  subject?: string;
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
    if (a.activityType === 'test') {
      window.location.assign('/tests');
    } else if (a.activityType === 'notes') {
      window.location.assign('/notes');
    } else if (a.activityType === 'practice') {
      window.location.assign('/tests');
    } else {
      window.location.assign('/');
    }
  }

  useEffect(() => { refresh(); }, []);

  return { activities, loading, refresh, resumeActivity };
}
