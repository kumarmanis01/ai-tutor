/**
 * FILE OBJECTIVE:
 * - Full control bar for demand-pull content generation: concept selector,
 *   difficulty slider, count stepper, and generate button. Emits GenerateParams
 *   via onGenerate when the student clicks Generate.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | add onDifficultyChange callback so GenerateView can sync difficulty to ConceptCards (task S3-1)
 * - 2026-06-09T00:00:00Z | claude | initial implementation for demand-pull generate flow (task S3)
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/UI/design-system';
import { ConceptSelector } from './ConceptSelector';
import type { ConceptOption } from './ConceptSelector';
import type { ToughnessRecommendation } from '@/lib/mastery/topicProgress';
import DifficultySlider from '@/components/dashboard/components/DifficultySlider';

export type ContentType = 'examples' | 'exercises' | 'quiz';

export interface GenerateParams {
  topicSlug: string;
  subject: string;
  grade: string;
  board: string;
  contentType: ContentType;
  conceptTitle: string | null;
  count: number;
  difficulty: number;
}

interface GenerateControlsProps {
  concepts: ConceptOption[];
  contentType: ContentType;
  topicSlug: string;
  subject: string;
  grade: string;
  board: string;
  recommendation: ToughnessRecommendation;
  onGenerate: (params: GenerateParams) => void;
  isGenerating: boolean;
  /** Optional: notified whenever the difficulty slider moves so parents can sync state. */
  onDifficultyChange?: (difficulty: number) => void;
}

const MIN_COUNT = 1;
const MAX_COUNT = 10;
const DEFAULT_COUNT = 5;

export function GenerateControls({
  concepts,
  contentType,
  topicSlug,
  subject,
  grade,
  board,
  recommendation,
  onGenerate,
  isGenerating,
  onDifficultyChange,
}: GenerateControlsProps) {
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [difficulty, setDifficulty] = useState(recommendation.toughness);

  function handleDecrement() {
    setCount((c) => Math.max(MIN_COUNT, c - 1));
  }

  function handleIncrement() {
    setCount((c) => Math.min(MAX_COUNT, c + 1));
  }

  function handleGenerate() {
    onGenerate({
      topicSlug,
      subject,
      grade,
      board,
      contentType,
      conceptTitle: selectedConcept,
      count,
      difficulty,
    });
  }

  const contentLabel = contentType.charAt(0).toUpperCase() + contentType.slice(1);
  const buttonLabel = isGenerating ? 'Generating...' : `Generate ${count} ${contentLabel}`;

  return (
    <div className="w-full space-y-3">
      {/* Concept selector */}
      <ConceptSelector
        concepts={concepts}
        value={selectedConcept}
        onChange={setSelectedConcept}
      />

      {/* Difficulty slider with AI recommendation badge */}
      <DifficultySlider
        value={difficulty}
        onChange={(d) => {
          setDifficulty(d);
          onDifficultyChange?.(d);
        }}
        recommendation={recommendation}
      />

      {/* Count stepper row: [−] [Generate N ContentType] [+] */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDecrement}
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
          className="flex-1 min-h-[44px]"
        >
          {buttonLabel}
        </Button>

        <button
          type="button"
          onClick={handleIncrement}
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

      {/* Count label */}
      <p className="text-xs text-muted-foreground text-center">
        {count} {count === 1 ? contentType.slice(0, -1) : contentType}
      </p>
    </div>
  );
}
