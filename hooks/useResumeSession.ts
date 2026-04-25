/**
 * FILE OBJECTIVE:
 * - React hook that fetches the student's most recent in-progress session.
 * - Returns { session, loading } where session is null when none is active.
 *
 * EDIT LOG:
 * - 2026-03-06 | claude | created for ResumeLessonCard
 */
'use client';

import { useEffect, useState } from 'react';

export interface ResumeSession {
  sessionId: string;
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
  phase: string;
  startedAt: string;
}

export function useResumeSession(): { session: ResumeSession | null; loading: boolean } {
  const [session, setSession] = useState<ResumeSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/session/resume')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSession(data?.session ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { session, loading };
}
