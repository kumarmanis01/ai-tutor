"use client";
/**
 * FILE OBJECTIVE:
 * - Fetch the recommended practice topic from the DB-backed engine.
 * - Priority: weak topic > current learning topic > next topic in path.
 * - No AI calls. No client-heavy computation.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec
 */
import { useEffect, useState } from 'react';

export interface PracticeRecommendation {
  recommendedTopicId: string | null;
  difficulty: string;
  lastAccuracy: number | null;
  questionCount: number;
}

/** Parse topic id from recommendation contentId or meta */
function parseTopicId(item: Record<string, unknown>): string | null {
  const meta = (item.meta && typeof item.meta === 'object' ? item.meta : {}) as Record<string, unknown>;
  if (meta.topicId) return String(meta.topicId);

  const contentId = String(item.contentId ?? item.id ?? '');
  // Formats: "generatedTest:abc123" | "topicNote:abc123" | plain id
  if (contentId.includes(':')) return contentId.split(':')[1] ?? null;
  return contentId || null;
}

export function usePracticeRecommendation(): PracticeRecommendation & { loading: boolean } {
  const [result, setResult] = useState<PracticeRecommendation>({
    recommendedTopicId: null,
    difficulty: 'medium',
    lastAccuracy: null,
    questionCount: 10,
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

        // Priority 1: weak topic (type === 'practice' or score is low)
        const weakItem = items.find((i) => {
          const t = String(i.type ?? '').toLowerCase();
          const score = typeof i.score === 'number' ? i.score : 1;
          return (t === 'practice' || t === 'test' || t === 'quiz') && score < 0.6;
        });

        // Priority 2: current learning topic (type notes/lesson)
        const learningItem = items.find((i) => {
          const t = String(i.type ?? '').toLowerCase();
          return t === 'notes' || t === 'lesson';
        });

        // Priority 3: first item in path
        const fallbackItem = items[0] ?? null;

        const chosen = weakItem ?? learningItem ?? fallbackItem;
        if (!chosen || cancelled) return;

        const topicId = parseTopicId(chosen);
        const difficulty = String(chosen.difficulty ?? 'medium').toLowerCase();
        const score = typeof chosen.score === 'number' ? chosen.score : null;
        const lastAccuracy = score !== null ? Math.round(score * 100) : null;

        const meta = (chosen.meta && typeof chosen.meta === 'object' ? chosen.meta : {}) as Record<string, unknown>;
        const questionCount = typeof meta.questionCount === 'number' ? meta.questionCount : 10;

        if (!cancelled) {
          setResult({ recommendedTopicId: topicId, difficulty, lastAccuracy, questionCount });
        }
      } catch {
        // Safe fallback — keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { ...result, loading };
}
