/**
 * FILE OBJECTIVE:
 * - 1-5 difficulty slider for chapter sessions with credit cost labels.
 *   Levels: 1-Very Easy (0.5 cr), 2-Easy (0.75), 3-Average (1.0),
 *   4-Advanced (1.25), 5-Expert (1.5 cr per item).
 *
 * EDIT LOG:
 * - 2026-06-09T12:00:00Z | claude | initial implementation for chapter session difficulty selector
 */

'use client';

import React, { useState } from 'react';

// ─── Level metadata ───────────────────────────────────────────────────────────

export interface DifficultyLevel {
  label: string;
  creditCost: number;
}

export const CHAPTER_DIFFICULTY_LEVELS: Record<number, DifficultyLevel> = {
  1: { label: 'Very Easy', creditCost: 0.5 },
  2: { label: 'Easy', creditCost: 0.75 },
  3: { label: 'Average', creditCost: 1.0 },
  4: { label: 'Advanced', creditCost: 1.25 },
  5: { label: 'Expert', creditCost: 1.5 },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface ChapterDifficultySliderProps {
  value: number;
  onChange: (level: number) => void;
}

export function ChapterDifficultySlider({ value, onChange }: ChapterDifficultySliderProps) {
  const [expanded, setExpanded] = useState(false);
  const level = CHAPTER_DIFFICULTY_LEVELS[value] ?? CHAPTER_DIFFICULTY_LEVELS[3];

  const chipClass =
    value <= 2
      ? 'bg-success-bg text-success'
      : value === 3
      ? 'bg-primary-bg text-primary'
      : 'bg-warning-bg text-warning';

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls="chapter-difficulty-panel"
        className={[
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
          'text-xs font-medium leading-none whitespace-nowrap',
          'min-h-[44px] sm:min-h-0 sm:py-1.5',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
          chipClass,
        ].join(' ')}
      >
        <span aria-hidden="true">&#9881;</span>
        <span>
          {value} -- {level.label} ({level.creditCost} cr/item)
        </span>
        <span
          aria-hidden="true"
          className={`inline-block transition-transform duration-150 ${expanded ? 'rotate-180' : 'rotate-0'}`}
        >
          &#9662;
        </span>
      </button>

      {expanded && (
        <div
          id="chapter-difficulty-panel"
          className="mt-2 p-3 rounded-lg border border-border bg-card dark:bg-gray-900"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">1 -- Very Easy</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${chipClass}`}>
              Level {value} -- {level.label}
            </span>
            <span className="text-xs text-muted-foreground">5 -- Expert</span>
          </div>

          <div className="flex items-center min-h-[44px]">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={value}
              onChange={(e) => {
                onChange(parseInt(e.target.value, 10));
              }}
              aria-label={`Difficulty level, currently ${value} -- ${level.label}`}
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={value}
              className={[
                'w-full h-2 rounded-lg appearance-none cursor-pointer',
                'bg-gray-200 dark:bg-gray-700',
                value <= 2 ? 'accent-success' : value === 3 ? 'accent-primary' : 'accent-warning',
              ].join(' ')}
            />
          </div>

          <div className="flex justify-between mt-1 px-0.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const lvl = CHAPTER_DIFFICULTY_LEVELS[n];
              return (
                <div key={n} className="flex flex-col items-center gap-0.5">
                  <span
                    className={`text-[10px] font-medium ${n === value ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    {n}
                  </span>
                  <span className="text-[9px] text-muted-foreground">{lvl.creditCost}cr</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
