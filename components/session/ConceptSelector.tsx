/**
 * FILE OBJECTIVE:
 * - Dropdown for selecting a specific concept or "All concepts (mixed)" within a topic.
 *   Shows the selected concept's summary in a Card below the dropdown.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial implementation for demand-pull generate flow (task S3)
 */

'use client';

import React from 'react';
import { Card } from '@/components/UI/design-system';

export interface ConceptOption {
  id: string;
  title: string;
  summary: string;
}

interface ConceptSelectorProps {
  concepts: ConceptOption[];
  value: string | null;
  onChange: (conceptTitle: string | null) => void;
  loading?: boolean;
}

const MIXED_VALUE = '__mixed__';

/** Converts the dropdown string value back to the typed API value (null = mixed). */
function toApiValue(raw: string): string | null {
  return raw === MIXED_VALUE ? null : raw;
}

export function ConceptSelector({ concepts, value, onChange, loading = false }: ConceptSelectorProps) {
  if (loading) {
    return (
      <div className="w-full" aria-busy="true" aria-label="Loading concepts">
        <div className="h-[44px] w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
    );
  }

  // Graceful fallback -- if no concepts seeded for this topic, render nothing
  if (concepts.length === 0) {
    return null;
  }

  const selectedConcept = concepts.find((c) => c.title === value) ?? null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onChange(toApiValue(e.target.value));
  }

  return (
    <div className="w-full space-y-2">
      <label htmlFor="concept-selector" className="sr-only">
        Select concept
      </label>
      <select
        id="concept-selector"
        value={value ?? MIXED_VALUE}
        onChange={handleChange}
        className={[
          'w-full rounded-lg border border-border bg-card text-foreground',
          'px-3 py-2 text-sm font-medium',
          'min-h-[44px]',
          'focus:outline-none focus:ring-2 focus:ring-primary',
          'dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100',
        ].join(' ')}
        aria-label="Select concept"
      >
        <option value={MIXED_VALUE}>All concepts (mixed)</option>
        {concepts.map((c) => (
          <option key={c.id} value={c.title}>
            {c.title}
          </option>
        ))}
      </select>

      {selectedConcept && (
        <Card padding="compact">
          <p className="text-xs text-muted-foreground italic leading-relaxed">
            {selectedConcept.summary}
          </p>
        </Card>
      )}
    </div>
  );
}
