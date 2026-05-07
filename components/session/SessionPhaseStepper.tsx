/**
 * SessionPhaseStepper
 *
 * Horizontal phase progress indicator for the session page.
 * Extracted from the inline stepper in app/(student)/session/[sessionId]/page.tsx.
 *
 * Visual states per phase:
 *   completed  → filled indigo bar + indigo label
 *   active     → medium indigo bar + indigo label (bold)
 *   upcoming   → gray bar + gray label
 *
 * Completed phases are clickable for review (calls onPhaseClick).
 * Active and future phases are non-interactive.
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | extracted + refined from session page inline stepper
 */
'use client';

import React from 'react';

const PHASE_ICONS: Record<string, string> = {
  OVERVIEW: '🗺️',
  EXPLANATION: '📖',
  PRACTICE: '✏️',
  TEST: '📝',
  HOMEWORK: '📋',
};

export interface SessionPhaseStepperProps {
  phases: string[];
  currentPhase: string;
  /** Called when student taps a completed phase for review */
  onPhaseClick?: (phase: string) => void;
}

export default function SessionPhaseStepper({
  phases,
  currentPhase,
  onPhaseClick,
}: SessionPhaseStepperProps) {
  const currentIdx = phases.indexOf(currentPhase);

  return (
    <nav aria-label="Session progress" className="flex items-center gap-1">
      {phases.map((p, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        const label = p.charAt(0) + p.slice(1).toLowerCase();
        const icon = PHASE_ICONS[p] ?? '●';

        return (
          <div key={p} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            {/* Progress bar */}
            <button
              type="button"
              disabled={!isDone}
              onClick={() => isDone && onPhaseClick?.(p)}
              aria-label={isDone ? `Review ${label}` : label}
              aria-current={isActive ? 'step' : undefined}
              className={`w-full h-2 rounded-full transition-colors ${
                isDone
                  ? 'bg-[#534AB7] cursor-pointer hover:bg-[#3C3489]'
                  : isActive
                    ? 'bg-indigo-400 cursor-default'
                    : 'bg-gray-200 cursor-default'
              }`}
            />
            {/* Label */}
            <span
              className={`text-[11px] text-center leading-tight truncate w-full px-0.5 ${
                isDone || isActive
                  ? isActive
                    ? 'text-[#534AB7] font-semibold'
                    : 'text-indigo-500 font-medium'
                  : 'text-gray-400'
              }`}
            >
              <span aria-hidden>{icon}</span> <span className="hidden sm:inline">{label}</span>
            </span>
          </div>
        );
      })}
    </nav>
  );
}