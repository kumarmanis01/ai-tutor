/**
 * FILE OBJECTIVE:
 * - Client hook to load, refresh, and cache student learning-map payload (S2.1).
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useLearningMap.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.1 useLearningMap hook with offline cache fallback
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type LearningMapNode = {
  chapterId: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  topicsCount: number;
  completedTopics: number;
  completionPercent: number;
  scorePercent: number;
  state: 'completed' | 'current' | 'locked' | 'premium-locked';
  ctaLabel: 'Start' | 'Continue' | 'Review' | null;
  tooltip: string | null;
  previewTopicId: string | null;
};

export type LearningMapPayload = {
  topBar: {
    xp: number;
    streak: number;
  };
  chapters: LearningMapNode[];
  currentChapter: LearningMapNode | null;
  lastSyncedAt: string;
};

const EMPTY_PAYLOAD: LearningMapPayload = {
  topBar: { xp: 0, streak: 0 },
  chapters: [],
  currentChapter: null,
  lastSyncedAt: new Date(0).toISOString(),
};

function cacheKey(studentId: string): string {
  return `learning-map-cache:${studentId}`;
}

export function useLearningMap(studentId: string) {
  const [data, setData] = useState<LearningMapPayload>(EMPTY_PAYLOAD);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineCache, setIsOfflineCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readCache = useCallback((): LearningMapPayload | null => {
    try {
      const raw = window.localStorage.getItem(cacheKey(studentId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LearningMapPayload;
      if (!parsed || !Array.isArray(parsed.chapters)) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [studentId]);

  const writeCache = useCallback(
    (payload: LearningMapPayload) => {
      try {
        window.localStorage.setItem(cacheKey(studentId), JSON.stringify(payload));
      } catch {
        // no-op: storage quota or private mode should not block UI
      }
    },
    [studentId]
  );

  const fetchMap = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/students/${encodeURIComponent(studentId)}/learning-map`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`Failed to load learning map (${res.status})`);
      }

      const payload = (await res.json()) as LearningMapPayload;
      setData(payload);
      setIsOfflineCache(false);
      writeCache(payload);
    } catch (err) {
      const cached = readCache();
      if (cached) {
        setData(cached);
        setIsOfflineCache(true);
      }
      setError(err instanceof Error ? err.message : 'Failed to load learning map');
    } finally {
      setIsLoading(false);
    }
  }, [readCache, studentId, writeCache]);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setData(cached);
      setIsOfflineCache(true);
      setIsLoading(false);
    }
    void fetchMap();
  }, [fetchMap, readCache]);

  const chapterCount = useMemo(() => data.chapters.length, [data.chapters.length]);

  return {
    data,
    isLoading,
    isOfflineCache,
    error,
    chapterCount,
    refresh: fetchMap,
  };
}

export default useLearningMap;
