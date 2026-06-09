/**
 * FILE OBJECTIVE:
 * - Reusable panel for Practice, Quiz, and Homework tabs in chapter sessions.
 *   Provides a 1-5 difficulty slider, question count stepper, credit cost preview,
 *   a Generate button, and a streaming output area.
 *
 * EDIT LOG:
 * - 2026-06-09T12:00:00Z | claude | initial implementation for chapter session generate panel
 */

'use client';

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button, Card } from '@/components/UI/design-system';
import { ChapterDifficultySlider, CHAPTER_DIFFICULTY_LEVELS } from './ChapterDifficultySlider';
import { useStream } from '@/hooks/useStream';

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelContentType = 'practice' | 'quiz' | 'homework';

interface ChapterGeneratePanelProps {
  chapterName: string;
  subject: string;
  grade: string;
  board: string;
  contentType: PanelContentType;
}

const PANEL_LABELS: Record<PanelContentType, string> = {
  practice: 'Exercises',
  quiz: 'Questions',
  homework: 'Problems',
};

const MIN_COUNT = 1;
const MAX_COUNT = 15;
const DEFAULT_COUNT = 5;
const DEFAULT_DIFFICULTY = 3;

// ─── Component ────────────────────────────────────────────────────────────────

export function ChapterGeneratePanel({
  chapterName,
  subject,
  grade,
  board,
  contentType,
}: ChapterGeneratePanelProps) {
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY);
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);
  const [creditsLimit, setCreditsLimit] = useState<number | null>(null);
  const { stream, abort } = useStream();

  const creditCost = (CHAPTER_DIFFICULTY_LEVELS[difficulty]?.creditCost ?? 1.0) * count;
  const itemLabel = PANEL_LABELS[contentType];

  const handleGenerate = useCallback(() => {
    abort();
    setGeneratedContent('');
    setGenerateError(null);
    setIsGenerating(true);

    stream(
      '/api/chapter/generate',
      { chapterName, subject, grade, board, contentType, difficulty, count },
      {
        onToken: (token) => setGeneratedContent((prev) => prev + token),
        onDone: () => setIsGenerating(false),
        onError: (msg) => {
          setIsGenerating(false);
          if (msg === 'daily_limit_reached') {
            setGenerateError("You've reached your daily limit. Come back tomorrow -- your best is still ahead.");
          } else {
            setGenerateError("Couldn't generate content -- tap to retry.");
          }
        },
        onMeta: (meta) => {
          setCreditsUsed(meta.creditsUsed);
          setCreditsLimit(meta.creditsLimit);
        },
      },
    );
  }, [abort, stream, chapterName, subject, grade, board, contentType, difficulty, count]);

  const buttonLabel = isGenerating
    ? 'Generating...'
    : `Generate ${count} ${itemLabel} · ${creditCost.toFixed(2)} credits`;

  return (
    <div className="space-y-4">
      <ChapterDifficultySlider value={difficulty} onChange={setDifficulty} />

      {/* Count stepper */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCount((c) => Math.max(MIN_COUNT, c - 1))}
          disabled={count <= MIN_COUNT || isGenerating}
          aria-label="Decrease count"
          className={[
            'flex items-center justify-center rounded-lg',
            'w-11 min-h-[44px]',
            'border border-border bg-card text-foreground text-lg font-semibold',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100',
          ].join(' ')}
        >
          -
        </button>

        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex-1 min-h-[44px] text-sm"
        >
          {buttonLabel}
        </Button>

        <button
          type="button"
          onClick={() => setCount((c) => Math.min(MAX_COUNT, c + 1))}
          disabled={count >= MAX_COUNT || isGenerating}
          aria-label="Increase count"
          className={[
            'flex items-center justify-center rounded-lg',
            'w-11 min-h-[44px]',
            'border border-border bg-card text-foreground text-lg font-semibold',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100',
          ].join(' ')}
        >
          +
        </button>
      </div>

      {/* Credit balance indicator */}
      {creditsUsed !== null && creditsLimit !== null && (
        <p className="text-xs text-muted-foreground text-right">
          {creditsUsed.toFixed(1)} / {creditsLimit} credits used today
        </p>
      )}

      {/* Output area */}
      <Card padding="compact">
        {generateError ? (
          <div className="space-y-2">
            <p className="text-sm text-error">{generateError}</p>
            <button
              type="button"
              onClick={() => setGenerateError(null)}
              className="text-xs text-primary underline min-h-[44px] sm:min-h-0"
            >
              Dismiss
            </button>
          </div>
        ) : generatedContent ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            <ReactMarkdown>{generatedContent}</ReactMarkdown>
            {isGenerating && (
              <span
                className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse rounded-sm"
                aria-hidden="true"
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Your {contentType} will appear here. Set difficulty and count above, then tap Generate.
          </p>
        )}
      </Card>
    </div>
  );
}
