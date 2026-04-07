'use client';
/**
 * FILE OBJECTIVE:
 * - Displays the 5 learning steps with clear completed / current / upcoming states.
 * - Derives state from currentPhase and PHASE_ORDER; UI-only, no session logic changes.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | extracted from components/Session/SessionHeader.tsx
 * - (date) | UX      | step list: ✔ completed, ● current, ○ upcoming
 */

import React from 'react';
import { PHASE_ORDER, PHASE_UI_CONFIG } from '@/lib/session/phaseConfig';
import type { SessionPhaseClient } from '@/lib/session/phaseConfig';

interface SessionProgressBarProps {
  currentPhase: SessionPhaseClient;
  phaseIndex: number;
  totalPhases: number;
  onStepClick?: (phase: string) => void;
}

export function SessionProgressBar({
  currentPhase,
  phaseIndex,
  totalPhases,
  onStepClick,
}: SessionProgressBarProps) {
  if (currentPhase === 'COMPLETE' || currentPhase === 'EXPIRED') return null;

  const steps = PHASE_ORDER.slice(0, totalPhases);

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">
        Step {phaseIndex + 1} of {totalPhases}
      </p>
      <ul className="flex flex-col gap-1.5" aria-label="Session progress">
        {steps.map((phase, i) => {
          const config = PHASE_UI_CONFIG[phase];
          const isCompleted = i < phaseIndex;
          const isCurrent = i === phaseIndex;
          const isUpcoming = i > phaseIndex;

          const label = (
            <>
              <span className="flex-shrink-0 w-5 text-center" aria-hidden>
                {isCompleted && <span className="text-green-600">✔</span>}
                {isCurrent && <span className="text-primary">●</span>}
                {isUpcoming && <span className="text-muted-foreground/50">○</span>}
              </span>
              <span>{config.label}</span>
            </>
          );

          return (
            <li
              key={phase}
              className={`flex items-center gap-2.5 text-sm ${
                isCurrent
                  ? 'text-foreground font-semibold'
                  : isCompleted
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/70'
              }`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isCompleted && onStepClick ? (
                <button
                  type="button"
                  onClick={() => onStepClick(phase)}
                  className="flex items-center gap-2.5 hover:text-foreground hover:underline cursor-pointer transition-colors min-h-[44px] w-full text-left"
                  aria-label={`Go back to ${config.label}`}
                >
                  {label}
                </button>
              ) : (
                <div className="flex items-center gap-2.5 min-h-[44px]">{label}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SessionProgressBar;
