'use client';
/**
 * FILE OBJECTIVE:
 * - Tutor Tip panel shown in session phases (sidebar on desktop, above content on mobile).
 * - Receives tipText from the phase for contextual guidance.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created as proper component (was a static placeholder)
 */

import React, { useState } from 'react';

interface TutorTipPanelProps {
  /** Contextual guidance shown to the student */
  tipText: string;
}

export function TutorTipPanel({ tipText }: TutorTipPanelProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 flex items-start gap-3 h-fit">
      <span className="text-lg flex-shrink-0 mt-0.5">💡</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground mb-0.5">Tutor Tip</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{tipText}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors text-xs p-1"
        aria-label="Dismiss tip"
      >
        ✕
      </button>
    </div>
  );
}

export default TutorTipPanel;
