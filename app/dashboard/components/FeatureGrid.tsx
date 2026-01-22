'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized feature grid with compact cards.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/FeatureGrid.spec.ts
 *
 * EDIT LOG:
 * - 2025-01-22 | copilot | simplified for mobile with compact grid
 */
import React from 'react';
import { useFeatureGrid } from '@/hooks/useFeatureGrid';

const featureEmoji: Record<string, string> = {
  practice: '✅',
  notes: '📖',
  doubts: '❓',
  video: '🎬',
  quiz: '🎯',
  default: '⚡',
};

const FeatureGrid: React.FC = () => {
  const { tiles, loading } = useFeatureGrid();

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card rounded-lg p-3 animate-pulse">
            <div className="w-8 h-8 bg-muted rounded-lg mx-auto mb-2" />
            <div className="h-3 bg-muted rounded w-2/3 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  const getEmoji = (key: string) => {
    if (key.includes('practice') || key.includes('test')) return featureEmoji.practice;
    if (key.includes('note')) return featureEmoji.notes;
    if (key.includes('doubt') || key.includes('ask')) return featureEmoji.doubts;
    if (key.includes('video')) return featureEmoji.video;
    if (key.includes('quiz')) return featureEmoji.quiz;
    return featureEmoji.default;
  };

  if (!tiles.length) {
    return (
      <div className="bg-muted/30 rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground">No features available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.slice(0, 6).map((t) => (
        <button
          key={t.key}
          className="bg-card hover:bg-muted/50 rounded-lg p-3 text-center active:scale-95 transition-transform"
        >
          <div className="text-2xl mb-1">{getEmoji(t.key)}</div>
          <p className="text-xs font-medium text-foreground truncate">{t.title}</p>
          {t.count ? <p className="text-[10px] text-muted-foreground">{t.count}</p> : null}
        </button>
      ))}
    </div>
  );
};

export default FeatureGrid;