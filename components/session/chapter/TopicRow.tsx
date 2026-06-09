/**
 * FILE OBJECTIVE:
 * - Single topic row in the chapter Topics tab. Shows title + 1-2 line description
 *   with an expandable Deep Dive section that streams AI content on demand.
 *   Collapses/re-expands from cache without re-fetching.
 *
 * EDIT LOG:
 * - 2026-06-09T16:00:00Z | claude | fix border-primary/20 -> border-brand-primary/20 (opacity mods need static token)
 * - 2026-06-09T12:00:00Z | claude | initial implementation for chapter session Topics tab
 */

'use client';

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card } from '@/components/UI/design-system';
import { useStream } from '@/hooks/useStream';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedTopic {
  title: string;
  description: string;
}

interface TopicRowProps {
  topic: ParsedTopic;
  chapterName: string;
  subject: string;
  grade: string;
  board: string;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DeepDiveSkeleton() {
  return (
    <div role="status" aria-label="Loading deep dive" className="space-y-2 pt-3">
      <div className="h-3 loader-shimmer rounded w-full" aria-hidden="true" />
      <div className="h-3 loader-shimmer rounded w-5/6" aria-hidden="true" />
      <div className="h-3 loader-shimmer rounded w-4/5" aria-hidden="true" />
      <span className="sr-only">Loading explanation...</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopicRow({ topic, chapterName, subject, grade, board }: TopicRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const { stream, abort } = useStream();

  const handleDeepDive = useCallback(() => {
    if (isStreaming) return;

    if (expanded && hasLoaded) {
      setExpanded(false);
      return;
    }

    if (!expanded && hasLoaded) {
      setExpanded(true);
      return;
    }

    setExpanded(true);
    setIsStreaming(true);
    setStreamedContent('');
    setStreamError(null);

    stream(
      '/api/chapter/generate',
      {
        chapterName,
        subject,
        grade,
        board,
        contentType: 'topic-deep-dive',
        topicTitle: topic.title,
      },
      {
        onToken: (token) => setStreamedContent((prev) => prev + token),
        onDone: () => {
          setIsStreaming(false);
          setHasLoaded(true);
        },
        onError: (msg) => {
          setIsStreaming(false);
          if (msg === 'daily_limit_reached') {
            setStreamError("You've reached your daily limit. Come back tomorrow -- your best is still ahead.");
          } else {
            setStreamError("Couldn't load -- tap to retry.");
          }
        },
      },
    );
  }, [isStreaming, expanded, hasLoaded, stream, chapterName, subject, grade, board, topic.title]);

  function getButtonLabel(): string {
    if (isStreaming) return 'Loading...';
    if (expanded && hasLoaded) return '↑ Close';
    return '+ Deep Dive';
  }

  return (
    <Card padding="compact">
      <h3 className="text-sm font-semibold text-foreground mb-1">{topic.title}</h3>
      {topic.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{topic.description}</p>
      )}

      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={handleDeepDive}
          disabled={isStreaming}
          aria-expanded={expanded}
          aria-label={getButtonLabel()}
          className={[
            'text-xs font-medium text-primary bg-primary-bg border border-brand-primary/20',
            'px-3 py-1.5 rounded-full',
            'min-h-[44px] sm:min-h-0 sm:py-1.5',
            'focus:outline-none focus:ring-2 focus:ring-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-opacity whitespace-nowrap',
          ].join(' ')}
        >
          {getButtonLabel()}
        </button>
      </div>

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
