'use client';
/**
 * FILE OBJECTIVE:
 * - Wraps the existing CascadingFilters in a collapsible accordion.
 * - Collapsed by default so the primary CTA (RecommendedPracticeCard) is above the fold.
 * - State machine: Start Practice CTA enforces topicId before navigating.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec — accordion wrapper, collapsed by default
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CascadingFilters, {
  CascadingFilterState,
  createEmptyFilterState,
} from '@/components/CascadingFilters';

export default function AdvancedPracticeFilters() {
  const [open, setOpen]       = useState(false);
  const [filters, setFilters] = useState<CascadingFilterState>(createEmptyFilterState());
  const router                = useRouter();

  function handleStartPractice() {
    if (!filters.topicId) return; // guard: require topicId
    const url = `/practice/start?topicId=${encodeURIComponent(filters.topicId)}${
      filters.difficulty ? `&difficulty=${encodeURIComponent(filters.difficulty)}` : ''
    }`;
    router.push(url);
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
      >
        <span>Advanced Practice Filters</span>
        <span className="text-muted-foreground text-xs">{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border space-y-4">
          <CascadingFilters
            value={filters}
            onChange={setFilters}
            useProfileDefaults={true}
            showLanguage={true}
            showDifficulty={true}
            showChapter={true}
            layout="grid"
            compact
          />

          <button
            type="button"
            onClick={handleStartPractice}
            disabled={!filters.topicId}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Practice with Selected Topic &rarr;
          </button>
          {!filters.topicId && (
            <p className="text-xs text-muted-foreground">
              Select a topic above to enable practice.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
