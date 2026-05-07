'use client';
/**
 * FILE OBJECTIVE:
 * - Sticky session header: back button, topic title, breadcrumb, phase strip,
 *   and a thin linear progress bar showing overall phase completion.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | refactored -- progress bar extracted to SessionProgressBar
 * - 2026-04-22 | redesign | add back button, topic title, thin progress fill bar
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SessionProgressBar } from './SessionProgressBar';
import type { SessionView, PhaseContent } from '@/lib/session/sessionEngine';

interface SessionHeaderProps {
  session: SessionView;
  phase: PhaseContent;
  onStepClick?: (phase: string) => void;
}

export function SessionHeader({ session, phase: _phase, onStepClick }: SessionHeaderProps) {
  const { topicName, subject, chapter, phaseIndex, totalPhases, currentPhase } = session;
  const router = useRouter();

  const [_selectedStyle, _setSelectedStyle] = useState<string | null>(null);
  const [_updatingStyle, _setUpdatingStyle] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(
          `/api/tutor/session/style?sessionId=${encodeURIComponent(session.sessionId)}`
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (!mounted) return;
        _setSelectedStyle(data?.explainStyle ?? null);
      } catch {
        // best-effort: ignore failures
      }
    })();
    return () => {
      mounted = false;
    };
  }, [session.sessionId]);

  // Completed phases as a percentage (0-100) for the thin progress fill.
  const progressPct = totalPhases > 0 ? Math.round((phaseIndex / totalPhases) * 100) : 0;

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/50">
      {/* Top row: back button + topic name */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {topicName}
          </p>
          <p className="text-xs text-muted-foreground truncate leading-tight">
            {subject} / {chapter}
          </p>
        </div>
      </div>

      {/* Horizontal phase strip */}
      <div className="px-4 pb-2 max-w-2xl mx-auto">
        <SessionProgressBar
          currentPhase={currentPhase as import('@/lib/session/phaseConfig').SessionPhaseClient}
          phaseIndex={phaseIndex}
          totalPhases={totalPhases}
          onStepClick={onStepClick}
        />
      </div>

      {/* Thin phase-progress fill bar */}
      <div
        className="h-0.5 bg-border/30"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Session progress"
      >
        <div
          className="h-full bg-[#534AB7] transition-[width] duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

export default SessionHeader;