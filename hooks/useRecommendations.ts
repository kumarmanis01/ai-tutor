"use client";
/**
 * FILE OBJECTIVE:
 * - Hook for fetching and tracking personalized content recommendations.
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useRecommendations.spec.ts
 *
 * EDIT LOG:
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
  const navigateToContent = useCallback((item: Recommendation) => {
    const contentId = item.contentId || item.id;
    const type = item.type?.toLowerCase() || '';
    
    // Track the click first
    trackClick(contentId);
    
    // Determine navigation based on content type
    let url = '/dashboard';
    
    if (type === 'lesson' || type === 'chapter') {
      // Navigate to learn page with course/chapter
      const courseId = item.meta?.courseId || item.contentId?.replace('chapter:', '');
      if (courseId) {
        url = `/learn/${encodeURIComponent(String(courseId))}`;
      } else {
        url = '/learn';
      }
    } else if (type === 'test' || type === 'practice' || type === 'quiz') {
      // Navigate to tests page with optional practice filter
      if (type === 'practice' && item.chapter) {
        url = `/tests?practice=${encodeURIComponent(item.chapter)}`;
      } else if (item.meta?.testId) {
        url = `/tests?resume=${encodeURIComponent(String(item.meta.testId))}`;
      } else {
        url = '/tests';
      }
    } else if (type === 'notes') {
      // Navigate to notes page
      const noteId = contentId.replace('note:', '');
      url = `/notes?noteId=${encodeURIComponent(noteId)}`;
    } else if (type === 'video' || type === 'session') {
      // Resume incomplete session
      const sessionRef = item.meta?.sessionRef || contentId;
      url = `/learn?resume=${encodeURIComponent(String(sessionRef))}`;
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
