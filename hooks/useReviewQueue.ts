'use client';
/**
 * FILE OBJECTIVE:
 * - Fetches topics due for spaced revision for the ReviewQueueCard.
 * - Calls /api/home/review-queue.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Gap #6 (review queue section)
 */

import useSWR from 'swr';

export interface ReviewTopic {
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
  mastery: number;
  daysSinceStudied: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useReviewQueue() {
  const { data, error, isLoading } = useSWR<{ topics: ReviewTopic[] }>(
    '/api/home/review-queue',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  return {
    topics: data?.topics ?? [],
    loading: isLoading,
    error,
  };
}
