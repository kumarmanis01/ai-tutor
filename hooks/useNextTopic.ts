/**
 * FILE OBJECTIVE:
 * - Fetch the single best next topic recommendation for the current student.
 * - Calls GET /api/student/next-topic, returns { topic, loading }.
 *
 * EDIT LOG:
 * - 2026-03-06 | Manish Kumar | created for TodaysLessonCard hero card
 */
'use client';

import { useEffect, useState } from 'react';

export interface NextTopic {
  topicId: string;
  topicTitle: string;
  subject: string;
  chapter: string;
  estimatedMinutes?: number;
  reason?: string;
}

export function useNextTopic(): { topic: NextTopic | null; loading: boolean } {
  const [topic, setTopic] = useState<NextTopic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/student/next-topic')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTopic(data?.topic ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { topic, loading };
}
