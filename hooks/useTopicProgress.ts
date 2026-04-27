/**
 * FILE OBJECTIVE:
 * - React hook for fetching and updating topic completion progress.
 *   Provides easy access to progress data and mutation functions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useTopicProgress.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created for MVP topic completion tracking
 */

import { useState, useEffect, useCallback } from 'react';

export interface TopicProgress {
  topicId: string;
  subject?: string;
  chapter?: string;
  masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  accuracy: number;
  questionsAttempted: number;
  lastAttemptedAt?: string;
  isCompleted: boolean;
  isStarted: boolean;
}

export interface UseTopicProgressOptions {
  subject?: string;
  chapter?: string;
  topicId?: string;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

export interface UseTopicProgressResult {
  /** Progress records matching the filter */
  progress: TopicProgress[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refetch progress data */
  refetch: () => Promise<void>;
  /** Record a topic view */
  recordView: (topicId: string, subject?: string, chapter?: string) => Promise<TopicProgress | null>;
  /** Mark a topic as completed */
  markComplete: (topicId: string, subject?: string, chapter?: string) => Promise<TopicProgress | null>;
  /** Check if a specific topic is completed */
  isTopicCompleted: (topicId: string) => boolean;
  /** Check if a specific topic has been started */
  isTopicStarted: (topicId: string) => boolean;
  /** Get progress for a specific topic */
  getTopicProgress: (topicId: string) => TopicProgress | undefined;
}

/**
 * useTopicProgress - Hook for managing topic completion progress.
 * Fetches and caches progress data, provides mutation functions.
 */
export function useTopicProgress(options: UseTopicProgressOptions = {}): UseTopicProgressResult {
  const { subject, chapter, topicId, autoFetch = true } = options;
  
  const [progress, setProgress] = useState<TopicProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (subject) params.set('subject', subject);
      if (chapter) params.set('chapter', chapter);
      if (topicId) params.set('topicId', topicId);
      
      const url = `/api/progress${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        if (res.status === 401) {
          // User not authenticated, return empty progress
          setProgress([]);
          return;
        }
        throw new Error('Failed to fetch progress');
      }
      
      const data = await res.json();
      setProgress(data.progress ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [subject, chapter, topicId]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchProgress();
    }
  }, [autoFetch, fetchProgress]);

  const recordView = useCallback(async (
    viewTopicId: string,
    viewSubject?: string,
    viewChapter?: string
  ): Promise<TopicProgress | null> => {
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: viewTopicId,
          subject: viewSubject,
          chapter: viewChapter,
          action: 'view',
        }),
      });
      
      if (!res.ok) return null;
      
      const data = await res.json();
      const mastery = data.mastery as TopicProgress | undefined;
      
      if (mastery) {
        // Update local state
        setProgress((prev) => {
          const existing = prev.findIndex((p) => p.topicId === viewTopicId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = mastery;
            return updated;
          }
          return [...prev, mastery];
        });
      }
      
      return mastery ?? null;
    } catch {
      return null;
    }
  }, []);

  const markComplete = useCallback(async (
    completeTopicId: string,
    completeSubject?: string,
    completeChapter?: string
  ): Promise<TopicProgress | null> => {
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: completeTopicId,
          subject: completeSubject,
          chapter: completeChapter,
          action: 'complete',
        }),
      });
      
      if (!res.ok) return null;
      
      const data = await res.json();
      const mastery = data.mastery as TopicProgress | undefined;
      
      if (mastery) {
        // Update local state
        setProgress((prev) => {
          const existing = prev.findIndex((p) => p.topicId === completeTopicId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = mastery;
            return updated;
          }
          return [...prev, mastery];
        });
      }
      
      return mastery ?? null;
    } catch {
      return null;
    }
  }, []);

  const isTopicCompleted = useCallback((checkTopicId: string): boolean => {
    const p = progress.find((item) => item.topicId === checkTopicId);
    return p?.isCompleted ?? false;
  }, [progress]);

  const isTopicStarted = useCallback((checkTopicId: string): boolean => {
    const p = progress.find((item) => item.topicId === checkTopicId);
    return p?.isStarted ?? false;
  }, [progress]);

  const getTopicProgress = useCallback((checkTopicId: string): TopicProgress | undefined => {
    return progress.find((item) => item.topicId === checkTopicId);
  }, [progress]);

  return {
    progress,
    isLoading,
    error,
    refetch: fetchProgress,
    recordView,
    markComplete,
    isTopicCompleted,
    isTopicStarted,
    getTopicProgress,
  };
}
