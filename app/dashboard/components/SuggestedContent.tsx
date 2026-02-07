'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized suggested content with compact horizontal scroll.
 *   Uses item.type directly for proper emoji/badge display.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/SuggestedContent.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-01 | claude  | use item.type for emoji, add test/notes action labels
 * - 2026-01-22 | copilot | added navigation on click with visual cue
 * - 2025-01-22 | copilot | simplified for mobile with compact cards
 */
import React from 'react';
import { useRecommendations } from '@/hooks/useRecommendations';

const TYPE_DISPLAY: Record<string, { emoji: string; action: string }> = {
  notes: { emoji: '📖', action: 'Read' },
  test: { emoji: '📝', action: 'Take Test' },
  quiz: { emoji: '❓', action: 'Start Quiz' },
  practice: { emoji: '🎯', action: 'Practice' },
  chapter: { emoji: '📚', action: 'Study' },
  lesson: { emoji: '✨', action: 'Start' },
  video: { emoji: '🎬', action: 'Watch' },
};

function getTypeDisplay(type: string) {
  return TYPE_DISPLAY[type?.toLowerCase()] || { emoji: '✨', action: 'Start' };
}

const SuggestedContent: React.FC = () => {
  const { items, loading, navigateToContent } = useRecommendations();

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-shrink-0 w-40 bg-card rounded-lg p-3 animate-pulse">
            <div className="w-8 h-8 bg-muted rounded-lg mb-2" />
            <div className="h-3 bg-muted rounded w-3/4 mb-1" />
            <div className="h-2 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="bg-muted/30 rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground">No suggestions yet</p>
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3">
      {items.slice(0, 6).map((item) => {
        const display = getTypeDisplay(item.type);

        return (
          <button
            key={item.id}
            onClick={() => navigateToContent(item)}
            className="flex-shrink-0 w-40 bg-card hover:bg-muted/50 rounded-lg p-3 text-left active:scale-95 transition-transform"
          >
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-base mb-2">
              {display.emoji}
            </div>
            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
            <p className="text-xs text-muted-foreground truncate">{item.subject}</p>
            <div className="flex items-center gap-1 mt-1">
              <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-xs text-primary">{display.action}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default SuggestedContent;
