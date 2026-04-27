'use client';
/**
 * FILE OBJECTIVE:
 * - Fetches weak topics list for the WeakTopicsCard component.
 * - Calls /api/home/weak-topics.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Gap #7 (weak topics section)
 */

import useSWR from 'swr';

export interface WeakTopic {
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
  mastery: number;
  accuracyPercent: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useWeakTopics() {
  const { data, error, isLoading } = useSWR<{ topics: WeakTopic[] }>(
    '/api/home/weak-topics',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  return {
    topics: data?.topics ?? [],
    loading: isLoading,
    error,
  };
}
