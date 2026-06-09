/**
 * FILE OBJECTIVE:
 * - Streaming topic list for the chapter Topics tab. Starts generating on mount.
 *   Shows raw streamed text with a cursor while generating, then parses the
 *   completed markdown into TopicRow cards with Deep Dive expansion.
 *
 * EDIT LOG:
 * - 2026-06-09T12:30:00Z | claude | fix: reorder regex char class [-:\s] -> [\s:-] to prevent Tailwind CSS scan false positive
 * - 2026-06-09T12:00:00Z | claude | initial implementation for chapter session Topics tab
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/UI/design-system';
import { useStream } from '@/hooks/useStream';
import { TopicRow } from './TopicRow';
import type { ParsedTopic } from './TopicRow';

// ─── Topic parser ─────────────────────────────────────────────────────────────
//
// Parses AI output that follows the pattern:
//   **Topic Title**
//   One to two line description.
//
// Also handles numbered list formats like:
//   1. **Topic Title** - Description
//   or
//   **1. Topic Title**

function parseTopics(text: string): ParsedTopic[] {
  const topics: ParsedTopic[] = [];

  // Split into blocks by double newline or by lines starting with ** or number
  const lines = text.split('\n');
  let currentTitle = '';
  let currentDescription = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (currentTitle) {
        topics.push({ title: currentTitle, description: currentDescription.trim() });
        currentTitle = '';
        currentDescription = '';
      }
      continue;
    }

    // Match **Title** or **1. Title** or 1. **Title**
    const boldMatch = line.match(/^\*\*(?:\d+\.\s+)?(.+?)\*\*/);
    const numberedMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*(.*)$/) || line.match(/^\d+\.\s+(.+)/);

    if (boldMatch) {
      if (currentTitle) {
        topics.push({ title: currentTitle, description: currentDescription.trim() });
      }
      currentTitle = boldMatch[1].replace(/[*_]/g, '').trim();
      // Check for inline description after the bold span
      const afterBold = line.replace(/^\*\*(?:\d+\.\s+)?(.+?)\*\*/, '').replace(/^[\s:-]+/, '').trim();
      currentDescription = afterBold;
    } else if (numberedMatch && !currentTitle) {
      if (currentTitle) {
        topics.push({ title: currentTitle, description: currentDescription.trim() });
      }
      currentTitle = (numberedMatch[1] ?? '').replace(/[*_]/g, '').trim();
      currentDescription = (numberedMatch[2] ?? '').replace(/^[\s:-]+/, '').trim();
    } else if (currentTitle) {
      // Continuation line = description
      currentDescription += (currentDescription ? ' ' : '') + line;
    }
  }

  if (currentTitle) {
    topics.push({ title: currentTitle, description: currentDescription.trim() });
  }

  return topics.filter((t) => t.title.length > 0);
}

// ─── Skeleton list ────────────────────────────────────────────────────────────

function TopicListSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Generating topics...">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="h-4 loader-shimmer rounded w-2/5" aria-hidden="true" />
          <div className="h-3 loader-shimmer rounded w-4/5" aria-hidden="true" />
          <div className="h-3 loader-shimmer rounded w-3/5" aria-hidden="true" />
        </div>
      ))}
      <span className="sr-only">Generating topic list...</span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopicListProps {
  chapterName: string;
  subject: string;
  grade: string;
  board: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopicList({ chapterName, subject, grade, board }: TopicListProps) {
  const [streamedText, setStreamedText] = useState('');
  const [isDone, setIsDone] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedTopics, setParsedTopics] = useState<ParsedTopic[]>([]);
  const { stream, abort } = useStream();
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    setIsStreaming(true);
    setStreamedText('');
    setError(null);
    setIsDone(false);

    stream(
      '/api/chapter/generate',
      { chapterName, subject, grade, board, contentType: 'topics' },
      {
        onToken: (token) => setStreamedText((prev) => prev + token),
        onDone: () => {
          setIsStreaming(false);
          setIsDone(true);
        },
        onError: (msg) => {
          setIsStreaming(false);
          if (msg === 'daily_limit_reached') {
            setError("You've reached your daily limit. Come back tomorrow -- your best is still ahead.");
          } else {
            setError("Couldn't load topics -- tap to retry.");
          }
        },
      },
    );

    return () => {
      abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parse when streaming completes
  useEffect(() => {
    if (isDone && streamedText) {
      setParsedTopics(parseTopics(streamedText));
    }
  }, [isDone, streamedText]);

  function handleRetry() {
    hasFired.current = false;
    setStreamedText('');
    setIsDone(false);
    setError(null);
    setParsedTopics([]);

    setIsStreaming(true);
    stream(
      '/api/chapter/generate',
      { chapterName, subject, grade, board, contentType: 'topics' },
      {
        onToken: (token) => setStreamedText((prev) => prev + token),
        onDone: () => {
          setIsStreaming(false);
          setIsDone(true);
        },
        onError: (msg) => {
          setIsStreaming(false);
          setError(msg === 'daily_limit_reached'
            ? "You've reached your daily limit. Come back tomorrow -- your best is still ahead."
            : "Couldn't load topics -- tap to retry.",
          );
        },
      },
    );
  }

  if (error) {
    return (
      <Card padding="compact" className="space-y-2">
        <p className="text-sm text-error">{error}</p>
        <button
          type="button"
          onClick={handleRetry}
          className="text-xs text-primary underline min-h-[44px] sm:min-h-0"
        >
          Tap to retry
        </button>
      </Card>
    );
  }

  // Still streaming and nothing parsed yet -- show skeleton
  if (isStreaming && parsedTopics.length === 0) {
    return (
      <div className="space-y-4">
        <TopicListSkeleton />
        {/* Show raw stream text below skeletons so user sees progress */}
        {streamedText && (
          <Card padding="compact">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {streamedText}
              <span
                className="inline-block w-1 h-3 ml-0.5 bg-primary animate-pulse rounded-sm"
                aria-hidden="true"
              />
            </p>
          </Card>
        )}
      </div>
    );
  }

  // Done -- show parsed topic cards
  if (isDone && parsedTopics.length > 0) {
    return (
      <div className="space-y-3">
        {parsedTopics.map((topic, i) => (
          <TopicRow
            key={`${topic.title}-${i}`}
            topic={topic}
            chapterName={chapterName}
            subject={subject}
            grade={grade}
            board={board}
          />
        ))}
      </div>
    );
  }

  // Done but parse failed (unexpected format) -- show raw text
  if (isDone && streamedText) {
    return (
      <Card padding="compact">
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed">{streamedText}</pre>
        </div>
      </Card>
    );
  }

  return <TopicListSkeleton />;
}
