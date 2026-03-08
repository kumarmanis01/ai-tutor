'use client';
/**
 * FILE OBJECTIVE:
 * - Tutor Tip panel shown during Explanation and Practice phases.
 * - Closes Gap #14: "No Tutor Tip panel" from the architecture review.
 * - Phase-aware tips pulled from a small curated table; fallback to generic tip.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created as proper component (was a static placeholder)
 */

import React, { useState } from 'react';

interface TutorTipPanelProps {
  /** Phase determines tip category */
  phase: 'EXPLANATION' | 'PRACTICE' | 'TEST';
  /** Topic name used to personalise tip where possible */
  topicName?: string;
  /** Optional custom tip to show instead of the auto-selected one */
  tip?: string;
}

// Generic tips per phase — future: could be fetched from content metadata
const PHASE_TIPS: Record<string, string[]> = {
  EXPLANATION: [
    "Read each concept slowly. It's better to understand one idea deeply than to skim many.",
    "If a concept is unclear, note it down — your practice results will highlight it too.",
    'Try to connect new concepts to something you already know.',
  ],
  PRACTICE: [
    "If you're unsure, eliminate options you know are wrong first.",
    'Read the question carefully — look for words like "not", "always", or "never".',
    'Mistakes are data. Every wrong answer tells you exactly what to review.',
  ],
  TEST: [
    'Trust your preparation. Answer every question — a guess is better than a blank.',
    'Read each question fully before looking at options.',
    'If stuck, move on and come back — your brain works in the background.',
  ],
};

export function TutorTipPanel({ phase, topicName: _topicName, tip }: TutorTipPanelProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const tips = PHASE_TIPS[phase] ?? PHASE_TIPS.EXPLANATION;
  // Rotate tips by current minute so it feels fresh across sessions
  const selectedTip = tip ?? tips[Math.floor(Date.now() / 60000) % tips.length];

  return (
    <div className="mx-4 my-4 max-w-2xl mx-auto">
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 flex items-start gap-3">
        <span className="text-lg flex-shrink-0 mt-0.5">💡</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground mb-0.5">Tutor Tip</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{selectedTip}</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors text-xs p-1"
          aria-label="Dismiss tip"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default TutorTipPanel;
