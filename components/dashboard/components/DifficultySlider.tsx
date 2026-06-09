/**
 * FILE OBJECTIVE:
 * - Collapsible difficulty selector (1-10) rendered above the question input.
 *   Collapsed: shows a small chip. Expanded: shows a native range slider with
 *   band labels (Easier / Standard / Challenge) using brand tokens.
 *   When a recommendation is provided, shows an amber "AI recommends" Pill badge
 *   above the slider; the badge dims to 50% opacity when the slider is moved away
 *   from the recommended value.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | S2-3a: add recommendation prop -- amber Pill badge, green tick marker, dim-on-drag
 * - 2026-06-09T00:00:00Z | claude | initial creation for difficulty parameter feature
 */

'use client';

import React, { useState } from 'react';
import type { ToughnessRecommendation } from '@/lib/mastery/topicProgress';

// ─── Band definitions ──────────────────────────────────────────────────────────

type Band = 'easier' | 'standard' | 'challenge';

function getBand(level: number): Band {
  if (level <= 3) return 'easier';
  if (level <= 6) return 'standard';
  return 'challenge';
}

const BAND_LABEL: Record<Band, string> = {
  easier: 'Easier',
  standard: 'Standard',
  challenge: 'Challenge',
};

// Uses the same Tailwind token names as Pill.tsx (bg-success-bg / bg-primary-bg / bg-warning-bg)
const BAND_CHIP_CLASS: Record<Band, string> = {
  easier:   'bg-success-bg text-success',
  standard: 'bg-primary-bg text-primary',
  challenge: 'bg-warning-bg text-warning',
};

const BAND_ACCENT_CLASS: Record<Band, string> = {
  easier:   'accent-success',
  standard: 'accent-primary',
  challenge: 'accent-warning',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface DifficultySliderProps {
  value?: number;
  onChange: (difficulty: number) => void;
  recommendation?: ToughnessRecommendation;
}

export default function DifficultySlider({
  value,
  onChange,
  recommendation,
}: DifficultySliderProps) {
  const [expanded, setExpanded] = useState(false);
  const effectiveValue = value ?? recommendation?.toughness ?? 5;
  const band = getBand(effectiveValue);
  const atRecommended = recommendation != null && effectiveValue === recommendation.toughness;

  return (
    <div className="mb-2">
      {/* AI recommends badge -- shown when recommendation is provided */}
      {recommendation && (
        <div
          className={`mb-1 transition-opacity duration-200 ${atRecommended ? 'opacity-100' : 'opacity-50'}`}
          data-testid="recommendation-badge"
        >
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-warning-bg text-warning">
            AI recommends: Examples at toughness {recommendation.toughness}
          </span>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
            {recommendation.reason}
          </p>
        </div>
      )}

      {/* Collapsed chip -- tap to expand */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls="difficulty-slider-panel"
        className={[
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
          'text-xs font-medium leading-none whitespace-nowrap',
          'min-h-[44px] sm:min-h-0 sm:py-1',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
          BAND_CHIP_CLASS[band],
        ].join(' ')}
      >
        <span aria-hidden="true">&#9881;</span>
        <span>Difficulty: {effectiveValue}</span>
        <span
          aria-hidden="true"
          className={`inline-block transition-transform duration-150 ${expanded ? 'rotate-180' : 'rotate-0'}`}
        >
          &#9662;
        </span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div
          id="difficulty-slider-panel"
          className="mt-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        >
          {/* Band labels row */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">1 -- Easier</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BAND_CHIP_CLASS[band]}`}>
              Level {effectiveValue} -- {BAND_LABEL[band]}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">10 -- Challenge</span>
          </div>

          {/* Slider -- min-h-[44px] for touch target */}
          <div className="flex items-center min-h-[44px]">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={effectiveValue}
              onChange={(e) => onChange(parseInt(e.target.value, 10))}
              aria-label={`Difficulty level, currently ${effectiveValue} -- ${BAND_LABEL[band]}`}
              aria-valuemin={1}
              aria-valuemax={10}
              aria-valuenow={effectiveValue}
              className={[
                'w-full h-2 rounded-lg appearance-none cursor-pointer',
                'bg-gray-200 dark:bg-gray-700',
                BAND_ACCENT_CLASS[band],
              ].join(' ')}
            />
          </div>

          {/* Tick marks -- recommended position gets a green success dot */}
          <div className="flex justify-between mt-1 px-0.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <span
                key={n}
                className={[
                  'text-[10px] select-none',
                  recommendation && n === recommendation.toughness
                    ? 'text-success font-bold'
                    : 'text-gray-300 dark:text-gray-600',
                ].join(' ')}
              >
                {recommendation && n === recommendation.toughness ? '●' : n}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
