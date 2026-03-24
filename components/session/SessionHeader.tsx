'use client';
/**
 * FILE OBJECTIVE:
 * - Sticky session header: breadcrumb (Topic / Chapter / Subject) + progress bar.
 * - Thin: delegates progress rendering to SessionProgressBar.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | refactored -- progress bar extracted to SessionProgressBar
 */

import React from 'react';
import Link from 'next/link';
import { SessionProgressBar } from './SessionProgressBar';
import type { SessionView, PhaseContent } from '@/lib/session/sessionEngine';

interface SessionHeaderProps {
  session: SessionView;
  phase: PhaseContent;
}

export function SessionHeader({ session, phase: _phase }: SessionHeaderProps) {
  const { topicName, subject, chapter, phaseIndex, totalPhases, currentPhase } = session;

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

      {/* Progress bar */}
      <div className="max-w-2xl mx-auto">
        <SessionProgressBar
          currentPhase={currentPhase as import('@/lib/session/phaseConfig').SessionPhaseClient}
          phaseIndex={phaseIndex}
          totalPhases={totalPhases}
        />
      </div>
    </div>
  );
}

export default SessionHeader;
