'use client';
/**
 * FILE OBJECTIVE:
 * - Displays the 5 learning steps as a compact horizontal scrollable pill strip.
 * - Completed steps are green pills (tappable to go back); current step is
 *   filled primary blue; upcoming steps are muted.
 * - Strip auto-scrolls to keep the current step centred when the phase changes.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | extracted from components/Session/SessionHeader.tsx
 * - 2026-04-22 | redesign | vertical overlay list -> horizontal scrollable strip
 */

import React, { useRef, useEffect } from 'react';
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
  const steps = PHASE_ORDER.slice(0, totalPhases);
  const stripRef = useRef<HTMLDivElement>(null);

  // Keep the active pill in view whenever the phase advances.
  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [phaseIndex]);

  if (currentPhase === 'COMPLETE' || currentPhase === 'EXPIRED') return null;

  return (
    <div
      ref={stripRef}
      className="flex items-center gap-1 overflow-x-auto"
      // Hide the scrollbar visually; swipe gesture still works.
      style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      aria-label="Session progress"
      role="list"
    >
      {steps.map((phase, i) => {
        const config = PHASE_UI_CONFIG[phase];
        const isCompleted = i < phaseIndex;
        const isCurrent = i === phaseIndex;

        const pillBase =
          'flex-shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full text-sm whitespace-nowrap transition-colors';
        const pillVariant = isCurrent
          ? 'bg-[#534AB7] text-white font-semibold'
          : isCompleted
            ? 'bg-[#EAF3DE] text-[#1D9E75] font-medium'
            : 'bg-transparent text-muted-foreground/50';

        const icon = isCompleted ? '✔' : isCurrent ? '●' : '○';

        const inner = (
          <>
            <span aria-hidden className="text-xs leading-none">
              {icon}
            </span>
            <span>{config.label}</span>
          </>
        );

        if (isCompleted && onStepClick) {
          return (
            <button
              key={phase}
              type="button"
              role="listitem"
              onClick={() => onStepClick(phase)}
              className={`${pillBase} ${pillVariant} hover:opacity-80 cursor-pointer`}
              aria-label={`Go back to ${config.label}`}
            >
              {inner}
            </button>
          );
        }

        return (
          <div
            key={phase}
            role="listitem"
            className={`${pillBase} ${pillVariant}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export default SessionProgressBar;
