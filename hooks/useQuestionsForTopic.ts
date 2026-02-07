/**
 * FILE OBJECTIVE:
 * - Reusable hook to fetch tests/questions for a given topic.
 * - Used by cascading filter components.
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useQuestionsForTopic.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | created for cascading filters
 */

import useSWR from 'swr';

export interface TestOption {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  language: string;
  version: number;
  topicId: string;
  questionCount: number;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Fetch tests/questions for a specific topic.
 *
 * @param topicId    - Topic ID. Pass null/undefined to skip.
 * @param difficulty - Difficulty level (easy, medium, hard). Optional filter.
 * @param language   - Language code (en, hi). Optional filter.
 * @returns { tests, loading, error }
 */
export function useQuestionsForTopic(
  topicId: string | null | undefined,
  difficulty?: string | null | undefined,
  language?: string | null | undefined,
) {
  const shouldFetch = !!topicId;

  const params = new URLSearchParams();
  if (topicId) params.set('topicId', topicId);
  if (difficulty) params.set('difficulty', difficulty);
  if (language) params.set('language', language);

  const key = shouldFetch ? `/api/questions/for-topic?${params.toString()}` : null;

  const { data, error, isLoading } = useSWR<{ tests: TestOption[] }>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  return {
    tests: data?.tests ?? [],
    loading: isLoading,
    error,
  };
}

export default useQuestionsForTopic;
