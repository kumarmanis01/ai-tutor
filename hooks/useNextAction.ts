"use client";
/**
 * FILE OBJECTIVE:
 * - SWR-backed hook for the deterministic Home Tutor Engine endpoint.
 * - No business logic. No transformation. Pure data passthrough.
 * - Use for: dashboard hero, notes hero, practice hero.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per wiring spec
 */
import useSWR from 'swr';
import type { MasteryLevel } from '@prisma/client';

export type ActionType = 'notes' | 'practice';

export type RuleId =
  | 'resume_session'
  | 'daily_task'
  | 'low_mastery'
  | 'low_accuracy'
  | 'next_new_topic';

export interface NextAction {
  topicId: string | null;
  topicName: string | null;
  subject: string | null;
  chapter: string | null;
  ruleId: RuleId;
  reasonLabel: string;
  actionType: ActionType;
  masteryLevel?: MasteryLevel;
  accuracy?: number;
  sessionId?: string;
  estimatedTimeMin?: number;
}

interface NextActionResponse {
  action: NextAction | null;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<NextActionResponse>;
  });

export function useNextAction(): {
  action: NextAction | null;
  isLoading: boolean;
  error: unknown;
  refresh: () => void;
} {
  const { data, error, isLoading, mutate } = useSWR<NextActionResponse>(
    '/api/home/next-action',
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    action: data?.action ?? null,
    isLoading,
    error,
    refresh: () => mutate(),
  };
}
