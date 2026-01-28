'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized suggested content with compact horizontal scroll.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/SuggestedContent.spec.ts
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | added navigation on click with visual cue
 * - 2025-01-22 | copilot | simplified for mobile with compact cards
 */
import React from 'react';
import { useRecommendations } from '@/hooks/useRecommendations';

const typeEmoji: Record<string, string> = {
  notes: '📖',
  test: '📝',
  quiz: '❓',
  default: '✨',
};

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
      {items.slice(0, 5).map((item) => {
        const type = item.title.toLowerCase().includes('note') ? 'notes' 
          : item.title.toLowerCase().includes('test') ? 'test' 
          : item.title.toLowerCase().includes('quiz') ? 'quiz' 
          : 'default';
        const emoji = typeEmoji[type];
        
        return (
          <button
            key={item.id}
            onClick={() => navigateToContent(item)}
            className="flex-shrink-0 w-40 bg-card hover:bg-muted/50 rounded-lg p-3 text-left active:scale-95 transition-transform"
          >
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-base mb-2">
              {emoji}
            </div>
            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
            <p className="text-xs text-muted-foreground truncate">{item.subject}</p>
            <div className="flex items-center gap-1 mt-1">
              <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-xs text-primary">Start</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default SuggestedContent;