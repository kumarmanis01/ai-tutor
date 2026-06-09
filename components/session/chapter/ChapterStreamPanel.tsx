/**
 * FILE OBJECTIVE:
 * - Reusable streaming content panel for chapter sessions. Calls
 *   /api/chapter/generate with any contentType and streams Markdown tokens
 *   via SSE into a ReactMarkdown renderer. Auto-generates on mount when
 *   autoGenerate=true (used for topics list and notes tabs). Manual trigger
 *   when autoGenerate=false (used for quiz/exercises/homework with difficulty
 *   slider and count stepper).
 *
 * EDIT LOG:
 * - 2026-06-09T19:00:00Z | claude | created as single streaming panel for all chapter content tabs
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, Button } from '@/components/UI/design-system';
import { useStream } from '@/hooks/useStream';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreamPanelRequest {
  chapterName: string;
  subject: string;
  grade: string;
  board: string;
  contentType: string;
  topicTitle?: string;
  difficulty?: number;
  count?: number;
}

interface ChapterStreamPanelProps {
  request: StreamPanelRequest;
  /** Auto-generate on mount (for notes tabs). False = show controls first. */
  autoGenerate?: boolean;
  /** Optional controls rendered above the generate button (difficulty slider, count stepper) */
  controls?: React.ReactNode;
  /** Label for the generate button */
  generateLabel?: string;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ContentSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Generating content">
      {[100, 90, 80, 95, 70, 85, 60].map((w, i) => (
        <div key={i} className={`h-2.5 loader-shimmer rounded`} style={{ width: `${w}%` }} aria-hidden="true" />
      ))}
      <span className="sr-only">Generating -- please wait...</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChapterStreamPanel({
  request,
  autoGenerate = false,
  controls,
  generateLabel = 'Generate',
}: ChapterStreamPanelProps) {
  const [content, setContent] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditInfo, setCreditInfo] = useState<{ used: number; limit: number; cost: number } | null>(null);
  const { stream, abort } = useStream();
  const hasFired = useRef(false);

  const generate = useCallback(() => {
    abort();
    setContent('');
    setError(null);
    setDone(false);
    setStreaming(true);
    setCreditInfo(null);

    stream(
      '/api/chapter/generate',
      request,
      {
        onToken: (token) => setContent((prev) => prev + token),
        onMeta: (meta) => {
          const m = meta as { creditsUsed?: number; creditsLimit?: number; creditCost?: number };
          if (m.creditsUsed != null) {
            setCreditInfo({ used: m.creditsUsed, limit: m.creditsLimit ?? 50, cost: m.creditCost ?? 1 });
          }
        },
        onDone: () => { setStreaming(false); setDone(true); },
        onError: (msg) => {
          setStreaming(false);
          setError(
            msg === 'daily_limit_reached'
              ? "You've reached your daily limit. Come back tomorrow -- your best is still ahead."
              : "Couldn't generate -- tap to retry.",
          );
        },
      },
    );
  }, [abort, stream, request]);

  // Auto-fire on mount for notes-type content
  useEffect(() => {
    if (autoGenerate && !hasFired.current) {
      hasFired.current = true;
      generate();
    }
  }, [autoGenerate, generate]);

  // Idle state: show controls + generate button
  if (!streaming && !done && !error) {
    return (
      <Card>
        <div className="space-y-4 py-2">
          {controls && <div className="space-y-3">{controls}</div>}
          <Button
            variant="primary"
            onClick={generate}
            className="w-full min-h-[44px]"
          >
            {generateLabel}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Skeleton while waiting for first token */}
      {streaming && !content && <ContentSkeleton />}

      {/* Content card */}
      {(content || error) && (
        <Card padding="compact">
          {error ? (
            <div className="space-y-2">
              <p className="text-sm text-error">{error}</p>
              <button
                type="button"
                onClick={generate}
                className="text-xs text-primary underline min-h-[44px] sm:min-h-0"
              >
                Tap to retry
              </button>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
              <ReactMarkdown>{content}</ReactMarkdown>
              {streaming && (
                <span
                  className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse rounded-sm"
                  aria-hidden="true"
                />
              )}
            </div>
          )}
        </Card>
      )}

      {/* Footer: credit info + regenerate */}
      {done && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {creditInfo && (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {creditInfo.used.toFixed(1)} / {creditInfo.limit} credits used today
            </p>
          )}
          <div className="flex gap-3 flex-wrap">
            {controls && (
              <button
                type="button"
                onClick={() => { setDone(false); setContent(''); }}
                className="text-xs text-muted-foreground underline min-h-[44px] sm:min-h-0"
              >
                Change settings
              </button>
            )}
            <button
              type="button"
              onClick={generate}
              className="text-xs text-muted-foreground underline min-h-[44px] sm:min-h-0"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
