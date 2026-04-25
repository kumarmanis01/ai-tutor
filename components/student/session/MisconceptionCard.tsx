'use client';

/**
 * FILE OBJECTIVE:
 * - Small UI component to display a contrastive misconception artifact in-chat.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/session/MisconceptionCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | created MisconceptionCard
 */

import React from 'react';

export type ContrastiveArtifact = {
  misconceptionId: string;
  name: string;
  description?: string;
  correction: string;
  whyWrong?: string;
  whyCorrect?: string;
  applyTip?: string;
  suggestedPractice?: string;
};

export default function MisconceptionCard({ artifact }: { artifact: ContrastiveArtifact }) {
  return (
    <div className="v2-msg-appear mb-3 w-full max-w-[85%] rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/30 dark:bg-amber-900/10 dark:text-amber-100">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-semibold">Common misconception</div>
        <div className="text-[11px] text-amber-700 dark:text-amber-200">
          ID: {artifact.misconceptionId}
        </div>
      </div>
      <div className="mb-2 text-sm font-medium">{artifact.name}</div>
      {artifact.description && (
        <div className="mb-2 text-xs text-amber-800 dark:text-amber-200">
          {artifact.description}
        </div>
      )}
      <div className="mb-2">
        <div className="text-[12px] font-semibold">Correction</div>
        <div className="text-[13px] mt-1">{artifact.correction}</div>
      </div>
      {artifact.whyWrong && (
        <div className="mb-2 text-xs">
          <div className="font-semibold">Why this is wrong</div>
          <div className="mt-1">{artifact.whyWrong}</div>
        </div>
      )}
      {artifact.applyTip && (
        <div className="mb-2 text-xs">
          <div className="font-semibold">How to apply</div>
          <div className="mt-1">{artifact.applyTip}</div>
        </div>
      )}
      {artifact.suggestedPractice && (
        <div className="mb-2 text-xs">
          <div className="font-semibold">Suggested practice</div>
          <div className="mt-1">{artifact.suggestedPractice}</div>
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded-md bg-amber-700 px-3 py-1 text-xs font-semibold text-white"
        >
          Mark understood
        </button>
        <button
          type="button"
          className="rounded-md border border-amber-700 px-3 py-1 text-xs font-semibold text-amber-700"
        >
          Practice
        </button>
      </div>
    </div>
  );
}
