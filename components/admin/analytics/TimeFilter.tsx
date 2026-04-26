/**
 * FILE OBJECTIVE:
 * - A4.1: TimeFilter — period selector for the executive analytics dashboard.
 *   Options: Today, This Week, This Month, Custom Range.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/analytics/TimeFilter.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A4.1 TimeFilter component
 */

'use client';

import React, { useState } from 'react';

export type Period = 'today' | 'week' | 'month' | 'custom';

type TimeFilterProps = {
  value: Period;
  customStart?: string;
  customEnd?: string;
  onChange: (period: Period, start?: string, end?: string) => void;
};

const PRESETS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

/**
 * A4.1 — Time period filter for analytics.
 */
export function TimeFilter({ value, customStart, customEnd, onChange }: TimeFilterProps) {
  const [localStart, setLocalStart] = useState(customStart ?? '');
  const [localEnd, setLocalEnd] = useState(customEnd ?? '');

  function handlePreset(period: Period) {
    if (period !== 'custom') {
      onChange(period);
    } else {
      onChange('custom', localStart || undefined, localEnd || undefined);
    }
  }

  function handleCustomApply() {
    if (localStart && localEnd) {
      onChange('custom', localStart, localEnd);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => handlePreset(preset.value)}
          className={`min-h-[36px] rounded-xl px-4 text-sm font-semibold transition ${
            value === preset.value
              ? 'bg-[#534AB7] text-white'
              : 'border border-gray-200 bg-white text-gray-600 hover:bg-[#EEEDFE] hover:text-[#534AB7]'
          }`}
        >
          {preset.label}
        </button>
      ))}
      {value === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            className="min-h-[36px] rounded-xl border border-gray-200 px-3 text-sm focus:border-[#534AB7] focus:outline-none"
            aria-label="Custom start date"
          />
          <span className="text-sm text-gray-400">to</span>
          <input
            type="date"
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            className="min-h-[36px] rounded-xl border border-gray-200 px-3 text-sm focus:border-[#534AB7] focus:outline-none"
            aria-label="Custom end date"
          />
          <button
            type="button"
            disabled={!localStart || !localEnd}
            onClick={handleCustomApply}
            className="min-h-[36px] rounded-xl bg-[#534AB7] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

export default TimeFilter;
