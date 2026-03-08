'use client';
/**
 * FILE OBJECTIVE:
 * - Segmented phase progress bar extracted from SessionHeader.
 * - "Step 3 of 5 — Practice" with filled/active/empty segments.
 * - Separated per architecture spec so SessionHeader stays thin.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | extracted from components/Session/SessionHeader.tsx
 */

import React from 'react';
import { PHASE_UI_CONFIG } from '@/lib/session/phaseConfig';
import type { SessionPhaseClient } from '@/lib/session/phaseConfig';

interface SessionProgressBarProps {
  currentPhase: SessionPhaseClient;
  phaseIndex: number;
  totalPhases: number;
}

export function SessionProgressBar({
  currentPhase,
  phaseIndex,
  totalPhases,
}: SessionProgressBarProps) {
  if (currentPhase === 'COMPLETE' || currentPhase === 'EXPIRED') return null;

  const config = PHASE_UI_CONFIG[currentPhase];
  const stepLabel = `Step ${phaseIndex + 1} of ${totalPhases}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{config.icon}</span>
          <span className="font-semibold text-sm text-foreground">{config.label}</span>
        </div>
        <span className="text-xs text-muted-foreground">{stepLabel}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: totalPhases }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < phaseIndex
                ? 'bg-primary'
                : i === phaseIndex
                  ? 'bg-primary/60'
                  : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default SessionProgressBar;
