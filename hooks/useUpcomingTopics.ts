'use client';
/**
 * FILE OBJECTIVE:
 * - Fetches upcoming curriculum topics for the UpcomingTopics component.
 * - Calls /api/home/upcoming-topics.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Gap #9 (upcoming topics section)
 */

import useSWR from 'swr';

export interface UpcomingTopic {
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useUpcomingTopics() {
  const { data, error, isLoading } = useSWR<{ topics: UpcomingTopic[] }>(
    '/api/home/upcoming-topics',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  return {
    topics: data?.topics ?? [],
    loading: isLoading,
    error,
  };
}
