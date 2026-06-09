/**
 * FILE OBJECTIVE:
 * - ConceptCard: renders a concept title + summary with an expandable Deep Dive
 *   section. On first tap, streams a focused AI explanation inline via SSE.
 *   Toggle collapse/re-expand uses cached content -- no duplicate API calls.
 *   Resets when difficulty prop changes.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial implementation for Deep Dive per-concept card (task S3-1)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card } from '@/components/UI/design-system';
import { useStream } from '@/hooks/useStream';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConceptOption {
  id: string;
  title: string;
  summary: string;
}

interface ConceptCardProps {
  concept: ConceptOption;
  topicSlug: string;
  subject: string;
  grade: string;
  board: string;
  difficulty: number;
}

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────

function DeepDiveSkeleton() {
  return (
    <div role="status" aria-label="Loading deep dive" className="space-y-2">
      <div className="h-3 loader-shimmer rounded w-full" aria-hidden="true" />
      <div className="h-3 loader-shimmer rounded w-5/6" aria-hidden="true" />
      <div className="h-3 loader-shimmer rounded w-4/5" aria-hidden="true" />
      <span className="sr-only">Loading explanation...</span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ConceptCard({
  concept,
  topicSlug,
  subject,
  grade,
  board,
  difficulty,
}: ConceptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const { stream, abort } = useStream();

  // Reset when difficulty changes so next Deep Dive re-fetches at new level
  useEffect(() => {
    abort();
    setHasLoaded(false);
    setStreamedContent('');
    setExpanded(false);
    setIsStreaming(false);
    setStreamError(null);
  }, [difficulty, abort]);

  const handleDeepDive = useCallback(() => {
    if (isStreaming) return;

    if (expanded && hasLoaded) {
      // Second tap: collapse
      setExpanded(false);
      return;
    }

    if (!expanded && hasLoaded) {
      // Third tap (or any re-expand after collapse): show cached content, no API call
      setExpanded(true);
      return;
    }

    // First tap (not loaded yet): expand + stream
    setExpanded(true);
    setIsStreaming(true);
    setStreamedContent('');
    setStreamError(null);

    stream(
      '/api/concept/deep-dive',
      { topicSlug, subject, grade, board, conceptTitle: concept.title, difficulty },
      {
        onToken: (token) => setStreamedContent((prev: string) => prev + token),
        onDone: () => {
          setIsStreaming(false);
          setHasLoaded(true);
        },
        onError: (msg) => {
          setIsStreaming(false);
          if (msg === 'daily_limit_reached') {
            setStreamError("You have reached your daily limit. Come back tomorrow -- your best is still ahead.");
          } else {
            setStreamError("Couldn't load -- tap to retry.");
          }
        },
      },
    );
  }, [
    isStreaming,
    expanded,
    hasLoaded,
    stream,
    topicSlug,
    subject,
    grade,
    board,
    concept.title,
    difficulty,
  ]);

  function getButtonLabel(): string {
    if (isStreaming) return 'Loading...';
    if (expanded && hasLoaded) return '↑ Close';
    return '→ Deep Dive';
  }

  return (
    <Card padding="compact">
      <h3 className="text-sm font-medium text-foreground mb-1">{concept.title}</h3>
      <p className="text-xs text-muted-foreground italic leading-relaxed">{concept.summary}</p>

      {/* Deep Dive trigger -- bottom-right ghost link style */}
      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={handleDeepDive}
          disabled={isStreaming}
          aria-expanded={expanded}
          aria-label={getButtonLabel()}
          className={[
            'text-sm text-primary bg-transparent border-none cursor-pointer',
            'min-h-[44px] min-w-[44px] px-1',
            'focus:outline-none focus:ring-2 focus:ring-primary rounded',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-opacity',
          ].join(' ')}
        >
          {getButtonLabel()}
        </button>
      </div>

      {/* Expandable deep dive area */}
      {expanded && (
        <div className="border-t border-border mt-3 pt-3 min-h-[80px]">
          {streamError ? (
            <p className="text-xs text-error">{streamError}</p>
          ) : isStreaming && !streamedContent ? (
            <DeepDiveSkeleton />
          ) : streamedContent ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
              <ReactMarkdown>{streamedContent}</ReactMarkdown>
              {isStreaming && (
                <span
                  className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse rounded-sm"
                  aria-hidden="true"
                />
              )}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
