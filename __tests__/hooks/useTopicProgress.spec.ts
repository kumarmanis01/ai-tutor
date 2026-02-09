/**
 * FILE OBJECTIVE:
 * - Unit tests for useTopicProgress hook.
 *
 * LINKED UNIT TEST:
 * - (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created for MVP topic completion tracking
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useTopicProgress, TopicProgress } from '@/hooks/useTopicProgress';

// Mock fetch
global.fetch = jest.fn();

describe('useTopicProgress', () => {
  const mockProgress: TopicProgress[] = [
    {
      topicId: 'topic-1',
      subject: 'Math',
      chapter: 'Algebra',
      masteryLevel: 'advanced',
      accuracy: 85,
      questionsAttempted: 10,
      lastAttemptedAt: '2024-01-15T10:00:00Z',
      isCompleted: true,
      isStarted: true,
    },
    {
      topicId: 'topic-2',
      subject: 'Math',
      chapter: 'Algebra',
      masteryLevel: 'beginner',
      accuracy: 40,
      questionsAttempted: 3,
      lastAttemptedAt: '2024-01-14T10:00:00Z',
      isCompleted: false,
      isStarted: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: mockProgress }),
    });
  });

  it('fetches progress on mount when autoFetch is true', async () => {
    const { result } = renderHook(() => useTopicProgress({ autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/progress');
    expect(result.current.progress).toEqual(mockProgress);
  });

  it('does not fetch on mount when autoFetch is false', () => {
    renderHook(() => useTopicProgress({ autoFetch: false }));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('includes filter params in fetch URL', async () => {
    const { result } = renderHook(() =>
      useTopicProgress({
        subject: 'Math',
        chapter: 'Algebra',
        autoFetch: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/progress?subjectId=Math&chapterId=Algebra'
    );
  });

  it('handles 401 unauthorized gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
    });

    const { result } = renderHook(() => useTopicProgress({ autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.progress).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useTopicProgress({ autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch progress');
  });

  it('refetch updates progress', async () => {
    const { result } = renderHook(() => useTopicProgress({ autoFetch: false }));

    expect(result.current.progress).toEqual([]);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.progress).toEqual(mockProgress);
  });

  describe('recordView', () => {
    it('posts view action to API', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            mastery: {
              topicId: 'topic-3',
              masteryLevel: 'beginner',
              accuracy: 0,
              questionsAttempted: 0,
              isCompleted: false,
              isStarted: false,
            },
          }),
      });

      const { result } = renderHook(() => useTopicProgress({ autoFetch: false }));

      await act(async () => {
        await result.current.recordView('topic-3', 'Math', 'Geometry');
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: 'topic-3',
          subject: 'Math',
          chapter: 'Geometry',
          action: 'view',
        }),
      });
    });

    it('updates local state after recording view', async () => {
      const newMastery: TopicProgress = {
        topicId: 'topic-3',
        masteryLevel: 'beginner',
        accuracy: 0,
        questionsAttempted: 0,
        isCompleted: false,
        isStarted: false,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ mastery: newMastery }),
      });

      const { result } = renderHook(() => useTopicProgress({ autoFetch: false }));

      await act(async () => {
        await result.current.recordView('topic-3');
      });

      expect(result.current.progress).toContainEqual(newMastery);
    });
  });

  describe('markComplete', () => {
    it('posts complete action to API', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            mastery: {
              topicId: 'topic-1',
              masteryLevel: 'advanced',
              isCompleted: true,
            },
          }),
      });

      const { result } = renderHook(() => useTopicProgress({ autoFetch: false }));

      await act(async () => {
        await result.current.markComplete('topic-1', 'Math', 'Algebra');
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: 'topic-1',
          subject: 'Math',
          chapter: 'Algebra',
          action: 'complete',
        }),
      });
    });
  });

  describe('helper functions', () => {
    it('isTopicCompleted returns correct status', async () => {
      const { result } = renderHook(() => useTopicProgress({ autoFetch: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isTopicCompleted('topic-1')).toBe(true);
      expect(result.current.isTopicCompleted('topic-2')).toBe(false);
      expect(result.current.isTopicCompleted('nonexistent')).toBe(false);
    });

    it('isTopicStarted returns correct status', async () => {
      const { result } = renderHook(() => useTopicProgress({ autoFetch: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isTopicStarted('topic-1')).toBe(true);
      expect(result.current.isTopicStarted('topic-2')).toBe(true);
      expect(result.current.isTopicStarted('nonexistent')).toBe(false);
    });

    it('getTopicProgress returns progress for existing topic', async () => {
      const { result } = renderHook(() => useTopicProgress({ autoFetch: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const progress = result.current.getTopicProgress('topic-1');
      expect(progress).toEqual(mockProgress[0]);
    });

    it('getTopicProgress returns undefined for nonexistent topic', async () => {
      const { result } = renderHook(() => useTopicProgress({ autoFetch: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const progress = result.current.getTopicProgress('nonexistent');
      expect(progress).toBeUndefined();
    });
  });
});
