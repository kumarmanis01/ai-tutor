/**
 * FILE OBJECTIVE:
 * - NextActionCard: displays the student's recommended next learning action with a CTA button.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | created to satisfy pre-existing NextActionCard unit tests
 */

'use client';

import React, { useState } from 'react';

interface NextActionCardProps {
  topic: string;
  actionType?: 'lesson' | 'practice' | 'assignment';
  ruleId?: string;
  reasonLabel?: string;
}

const ACTION_LABELS: Record<string, string> = {
  lesson: 'Continue Lesson',
  practice: 'Practice Topic',
  assignment: 'Open Assignment',
};

export default function NextActionCard({ topic, actionType, ruleId, reasonLabel }: NextActionCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const label = actionType ? (ACTION_LABELS[actionType] ?? 'Start Lesson') : 'Start Lesson';

  return (
    <div>
      <span>{topic}</span>
      <button type="button">{label}</button>
      {ruleId && (
        <button
          type="button"
          aria-label={`Why this? rule:${ruleId}`}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
        >
          Why?
        </button>
      )}
      {showTooltip && ruleId && (
        <div role="tooltip" aria-label={`reason: ${reasonLabel ?? ''} rule:${ruleId}`}>
          {reasonLabel}
        </div>
      )}
    </div>
  );
}
