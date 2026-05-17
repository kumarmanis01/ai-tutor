'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 1: OVERVIEW -- Orients the student before starting the session.
 * - Topic intro, session steps preview, estimated time, learning goals, tutor message.
 * - "Students should never jump directly into content." -- spec
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | moved to components/session/phases/ (architecture refactor)
 */

import React from 'react';
import { Check, GraduationCap } from 'lucide-react';
import type { OverviewContent } from '@/lib/session/getPhaseContent';

interface OverviewPhaseProps {
  content: OverviewContent;
  reasonLabel?: string | null;
  estimatedTimeMin?: number;
  onReadyToProceed?: (ready: boolean) => void;
  loading?: boolean;
}

const DEFAULT_LEARNING_GOALS = [
  'Understand the concept',
  'Practice questions',
  'Take a short test',
  'Receive homework',
];

export function OverviewPhase({
  content,
  reasonLabel,
  estimatedTimeMin,
  onReadyToProceed,
  loading: _loading,
}: OverviewPhaseProps) {
  React.useEffect(() => {
    onReadyToProceed?.(true);
  }, [onReadyToProceed]);
  const learningGoals = content.objectives.length > 0 ? content.objectives : DEFAULT_LEARNING_GOALS;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-6">
        {/* Left: learning goals + summary */}
        <div className="space-y-4">
          {/* Learning goals */}
          <div className="bg-card rounded-xl border p-4">
            <h2 className="font-semibold text-foreground mb-3">You will:</h2>
            <ul className="space-y-2">
              {learningGoals.map((goal, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#1D9E75]" strokeWidth={1.75} aria-hidden />
                  {goal}
                </li>
              ))}
            </ul>
          </div>

          {content.summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">{content.summary}</p>
          )}
        </div>

        {/* Right: estimated time + tutor note */}
        <div className="space-y-4">
          {/* Estimated time */}
          {estimatedTimeMin != null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg
                className="w-4 h-4 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>Estimated time: {estimatedTimeMin} minutes</span>
            </div>
          )}

          {/* Tutor introduction message */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
            <GraduationCap className="w-5 h-5 flex-shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
            <div>
              <p className="text-xs font-semibold text-foreground mb-0.5">Tutor</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {reasonLabel ?? 'Pay attention to the example -- it will help during practice.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary CTA is in SessionFooter */}
    </div>
  );
}

export default OverviewPhase;