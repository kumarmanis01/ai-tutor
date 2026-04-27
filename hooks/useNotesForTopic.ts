/**
 * FILE OBJECTIVE:
 * - Reusable hook to fetch notes for a given topic.
 * - Used by cascading filter components.
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useNotesForTopic.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | created for cascading filters
 */

import useSWR from 'swr';

export interface NoteOption {
  id: string;
  title: string;
  language: string;
  version: number;
  topicId: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Fetch notes for a specific topic.
 *
 * @param topicId  - Topic ID. Pass null/undefined to skip.
 * @param language - Language code (en, hi). Optional filter.
 * @returns { notes, loading, error }
 */
export function useNotesForTopic(
  topicId: string | null | undefined,
  language?: string | null | undefined,
) {
  const shouldFetch = !!topicId;

  const params = new URLSearchParams();
  if (topicId) params.set('topicId', topicId);
  if (language) params.set('language', language);

  const key = shouldFetch ? `/api/notes/for-topic?${params.toString()}` : null;

  const { data, error, isLoading } = useSWR<{ notes: NoteOption[] }>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  return {
    notes: data?.notes ?? [],
    loading: isLoading,
    error,
  };
}

export default useNotesForTopic;
