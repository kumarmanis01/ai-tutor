"use client";
/**
 * FILE OBJECTIVE:
 * - Hook for fetching and tracking personalized content recommendations.
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useRecommendations.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-01 | claude  | navigate notes/tests to dashboard tabs with content ID
 * - 2026-01-22 | copilot | added navigateToContent for content navigation
 * - 2026-01-22 | copilot | enhanced with score, chapter, difficulty fields
 */
import { useEffect, useState, useCallback } from 'react';

export interface Recommendation {
  id: string;
  contentId?: string;
  type: string;
  subject: string;
  title: string;
  chapter?: string;
  difficulty?: string;
  score?: number;
  reasoning?: string;
  priority?: number;
  meta?: Record<string, unknown>;
}

export function useRecommendations() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/recommendations');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const trackClick = useCallback(async (id: string) => {
    try {
      await fetch('/api/dashboard/recommendations/track', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ contentId: id, event: 'clicked' }) 
      });
    } catch {}
  }, []);

  /**
   * Navigate to content based on recommendation type and metadata
   */
  const navigateToContent = useCallback(async (item: Recommendation) => {
    const contentId = item.contentId || item.id;
    const type = item.type?.toLowerCase() || '';

    // Track the click first (await so tracking is submitted before navigation)
    try { await trackClick(contentId); } catch {}

    // Determine navigation based on content type
    let url = '/dashboard';

    if (type === 'chapter') {
      // Chapter recommendations have meta.subjectId - navigate to subject page
      let subjectId = (item.meta as any)?.subjectId;

      // If subjectId not present, try resolving chapter -> subject via API
      if (!subjectId && typeof contentId === 'string' && contentId.startsWith('chapter:')) {
        const chapterId = contentId.split(':')[1];
        try {
          const res = await fetch(`/api/chapters/${chapterId}`);
          if (res.ok) {
            const chapter = await res.json().catch(() => null);
            subjectId = chapter?.subjectId;
          }
        } catch {}
      }

      if (subjectId) {
        url = `/learn/${subjectId}`;
      } else {
        url = '/learn';
      }
    } else if (type === 'lesson') {
      // Lesson recommendations - go to learn page
      url = '/learn';
    } else if (type === 'test' || type === 'practice' || type === 'quiz') {
      // Navigate to tests tab in dashboard with optional content ID
      const testContentId = contentId.startsWith('generatedTest:') ? contentId.split(':')[1] : '';
      url = testContentId
        ? `/dashboard?tab=tests&testId=${encodeURIComponent(testContentId)}`
        : '/dashboard?tab=tests';
    } else if (type === 'notes' || type === 'note') {
      // Navigate to notes tab in dashboard with optional note ID
      const noteContentId = contentId.startsWith('topicNote:') ? contentId.split(':')[1] : '';
      url = noteContentId
        ? `/dashboard?tab=notes&noteId=${encodeURIComponent(noteContentId)}`
        : '/dashboard?tab=notes';
    } else if (type === 'video' || type === 'session') {
      // Resume incomplete session - go to learn page
      url = '/learn';
    } else {
      // Default: go to learn page to show available subjects
      url = '/learn';
    }
    
    // Use window.location for navigation (works with any state)
    window.location.assign(url);
  }, [trackClick]);

  const trackCompleted = useCallback(async (id: string) => {
    try {
      await fetch('/api/dashboard/recommendations/track', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ contentId: id, event: 'completed' }) 
      });
    } catch {}
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      await fetch('/api/dashboard/recommendations/refresh', { method: 'POST' });
      // Refresh recommendations after profile update
      await refresh();
    } catch {}
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-track shown events once items are loaded
  useEffect(() => {
    if (!items || items.length === 0) return;
    const trackShown = async () => {
      try {
        await Promise.all(items.slice(0, 5).map((i) =>
          fetch('/api/dashboard/recommendations/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentId: i.contentId || i.id, event: 'shown' })
          })
        ));
      } catch {}
    };
    trackShown();
  }, [items]);

  return { 
    items, 
    loading, 
    error,
    refresh, 
    trackClick, 
    trackCompleted,
    refreshProfile,
    navigateToContent 
  };
}
