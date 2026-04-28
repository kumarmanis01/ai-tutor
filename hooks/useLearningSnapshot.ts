'use client';
/**
 * FILE OBJECTIVE:
 * - Fetches per-subject mastery snapshot for the SubjectMasteryBars component.
 * - Calls /api/home/learning-snapshot, returns subject-level progress.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Gap #5 (per-subject mastery bars)
 */

import useSWR from 'swr';

export interface SubjectSnapshot {
  subjectId: string;
  name: string;
  topicCount: number;
  completedTopics: number;
  percentComplete: number;
  mastery: number;
}

interface LearningSnapshotResponse {
  subjects: SubjectSnapshot[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useLearningSnapshot() {
  const { data, error, isLoading } = useSWR<LearningSnapshotResponse>(
    '/api/home/learning-snapshot',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    subjects: data?.subjects ?? [],
    loading: isLoading,
    error,
  };
}
