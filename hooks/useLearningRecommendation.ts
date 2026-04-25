'use client';
/**
 * FILE OBJECTIVE:
 * - Fetch the student's current learning recommendation from the DB-backed engine.
 * - No AI calls. No client-heavy computation. Uses stored engine output only.
 * - Target latency: <150 ms (single API call against pre-computed recommendations).
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec
 */
import { useEffect, useState } from 'react';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface CurrentTopic {
  subjectId: string;
  chapterId: string;
  topicId: string;
  difficulty: DifficultyLevel;
  estimatedTime: number; // minutes
}

export interface LearningRecommendation {
  currentTopic: CurrentTopic | null;
  progressPercent: number;
}

/** Extract topicId from content reference strings like "topicNote:abc" or plain id */
function parseTopicId(contentId: string | undefined): string | null {
  if (!contentId) return null;
  if (contentId.includes(':')) return contentId.split(':')[1] ?? null;
  return contentId;
}

/** Normalize difficulty string to the expected enum */
function normalizeDifficulty(d: string | undefined): DifficultyLevel {
  const lower = (d ?? '').toLowerCase();
  if (lower === 'easy' || lower === 'beginner') return 'easy';
  if (lower === 'hard' || lower === 'advanced' || lower === 'expert') return 'hard';
  return 'medium';
}

/** Estimate time in minutes from difficulty */
function estimatedTimeFor(difficulty: DifficultyLevel): number {
  if (difficulty === 'easy') return 15;
  if (difficulty === 'hard') return 45;
  return 30;
}

export function useLearningRecommendation(): LearningRecommendation & { loading: boolean } {
  const [result, setResult] = useState<LearningRecommendation>({
    currentTopic: null,
    progressPercent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/dashboard/recommendations');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        const items: Array<Record<string, unknown>> = Array.isArray(data?.items) ? data.items : [];

        // Pick the first notes/lesson recommendation; fall back to any item
        const item =
          items.find((i) => {
            const t = String(i.type ?? '').toLowerCase();
            return t === 'notes' || t === 'note' || t === 'lesson';
          }) ??
          items[0] ??
          null;

        if (!item || cancelled) {
          setResult({ currentTopic: null, progressPercent: 0 });
          return;
        }

        const meta = (item.meta && typeof item.meta === 'object' ? item.meta : {}) as Record<
          string,
          unknown
        >;
        const contentId = String(item.contentId ?? item.id ?? '');
        const topicId = String(meta.topicId ?? parseTopicId(contentId) ?? '');
        const chapterId = String(meta.chapterId ?? '');
        const subjectId = String(meta.subjectId ?? item.subject ?? '');

        if (!topicId) {
          setResult({ currentTopic: null, progressPercent: 0 });
          return;
        }

        const difficulty = normalizeDifficulty(String(item.difficulty ?? ''));
        const estimatedTime = estimatedTimeFor(difficulty);
        const progressPercent =
          typeof item.score === 'number' ? Math.min(100, Math.round(item.score * 100)) : 0;

        if (!cancelled) {
          setResult({
            currentTopic: { subjectId, chapterId, topicId, difficulty, estimatedTime },
            progressPercent,
          });
        }
      } catch {
        if (!cancelled) setResult({ currentTopic: null, progressPercent: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...result, loading };
}
