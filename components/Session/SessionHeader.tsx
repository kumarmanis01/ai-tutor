'use client';
/**
 * FILE OBJECTIVE:
 * - Persistent session header showing topic breadcrumb and phase progress bar.
 * - Always visible during a session — answers "where am I?" at a glance.
 * - Implements the spec: "[■■■□□] Step 3 of 5 — Practice"
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Container Architecture
 */

import React from 'react';
import Link from 'next/link';
import type { SessionView, PhaseContent } from '@/lib/session/sessionEngine';

const PHASE_ICONS: Record<string, string> = {
  OVERVIEW: '👁',
  EXPLANATION: '📖',
  PRACTICE: '🎯',
  TEST: '📝',
  HOMEWORK: '📋',
  COMPLETE: '🎉',
};

interface SessionHeaderProps {
  session: SessionView;
  phase: PhaseContent;
}

export function SessionHeader({ session, phase }: SessionHeaderProps) {
  const { topicName, subject, chapter, phaseIndex, totalPhases, currentPhase } = session;

  // phaseIndex is 0-based; display as 1-based
  const stepLabel = currentPhase === 'COMPLETE'
    ? 'Complete'
    : `Step ${phaseIndex + 1} of ${totalPhases}`;

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 max-w-2xl mx-auto">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <span>/</span>
        <span>{subject}</span>
        <span>/</span>
        <span>{chapter}</span>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{topicName}</span>
      </div>

      {/* Phase Progress Bar */}
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{PHASE_ICONS[currentPhase] ?? '📚'}</span>
            <span className="font-semibold text-sm text-foreground">{phase.label}</span>
          </div>
          <span className="text-xs text-muted-foreground">{stepLabel}</span>
        </div>

        {/* Segmented progress bar — one block per displayable phase */}
        {currentPhase !== 'COMPLETE' && (
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
        )}
      </div>
    </div>
  );
}

export default SessionHeader;
