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
  const [updating, setUpdating] = useState(false);

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

  async function updateProgress(sessionId: string, totalQuestions?: number, answeredCount?: number, currentQuestionIndex?: number) {
    setUpdating(true);
    try {
      await fetch('/api/learning-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, totalQuestions, answeredCount, currentQuestionIndex })
      });
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return { activities, loading, updating, refresh, resumeActivity, updateProgress };
}
