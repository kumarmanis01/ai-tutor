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
import type { OverviewContent } from '@/lib/session/getPhaseContent';
import { PHASE_ORDER, PHASE_UI_CONFIG } from '@/lib/session/phaseConfig';

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
  const steps = PHASE_ORDER.map((phase) => PHASE_UI_CONFIG[phase].label);
  const learningGoals =
    content.objectives.length > 0 ? content.objectives : DEFAULT_LEARNING_GOALS;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* 1. Topic introduction */}
      <div>
        <p className="text-sm text-muted-foreground mb-1">Today we will learn:</p>
        <h1 className="text-2xl font-bold text-foreground">{content.topicName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {content.subject} &rsaquo; {content.chapter}
        </p>
      </div>

      {/* 2. Session steps preview */}
      <div className="bg-card rounded-xl border p-4">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Session steps</h2>
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((label, i) => (
            <React.Fragment key={label}>
              <span className="px-3 py-1.5 bg-muted/80 text-foreground/90 text-xs font-medium rounded-lg">
                {label}
              </span>
              {i < steps.length - 1 && (
                <svg
                  className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 3. Estimated time */}
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

      {/* 4. Learning goals */}
      <div className="bg-card rounded-xl border p-4">
        <h2 className="font-semibold text-foreground mb-3">You will:</h2>
        <ul className="space-y-2">
          {learningGoals.map((goal, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
              <span className="text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5">✓</span>
              {goal}
            </li>
          ))}
        </ul>
      </div>

      {/* 5. Tutor introduction message */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl flex-shrink-0">🎓</span>
        <div>
          <p className="text-xs font-semibold text-foreground mb-0.5">Tutor</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {reasonLabel ?? 'Pay attention to the example -- it will help during practice.'}
          </p>
        </div>
      </div>

      {content.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{content.summary}</p>
      )}

      {/* Primary CTA is in SessionFooter */}
    </div>
  );
}

export default OverviewPhase;
