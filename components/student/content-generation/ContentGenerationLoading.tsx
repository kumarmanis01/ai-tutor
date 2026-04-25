/**
 * FILE OBJECTIVE:
 * - S3.2: ContentGenerationLoading — animated loading screen with cycling
 *   study messages shown while AI content is being generated.
 *   Transitions to StreamingContent when first block arrives.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/content-generation/ContentGenerationLoading.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S3.2 ContentGenerationLoading component
 */

'use client';

import React, { useEffect, useState } from 'react';

const LOADING_MESSAGES = [
  'Searching the knowledge library... 📚',
  'Consulting your AI Teacher... 🧑‍🏫',
  'Organising concepts and examples... 🗂️',
  'Crafting explanations just for you... ✍️',
  'Adding practice questions... 🎯',
  'Almost ready — polishing the final notes... ✨',
];

// Progress percentage for each step (shown as bar fill)
const STEP_PROGRESS = [10, 25, 45, 62, 78, 92];

type ContentGenerationLoadingProps = {
  topic: string;
};

/**
 * S3.2 — Full-screen loading state for AI content generation.
 * Cycles through LOADING_MESSAGES every ~4s.
 */
export function ContentGenerationLoading({ topic }: ContentGenerationLoadingProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((prev) => Math.min(prev + 1, LOADING_MESSAGES.length - 1));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const progress = STEP_PROGRESS[step] ?? 10;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Generating notes for ${topic}`}
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-10 text-center"
    >
      {/* Study buddy illustration placeholder */}
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#EEEDFE] text-5xl">
        🧑‍🏫
      </div>

      <h2 className="text-lg font-bold text-gray-900">
        Generating notes for{' '}
        <span className="text-[#534AB7]">&ldquo;{topic}&rdquo;</span>
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Your AI Teacher is putting this together.
      </p>

      {/* Progress bar */}
      <div className="mt-6 w-full max-w-sm overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-3 rounded-full bg-[#534AB7] transition-all duration-700"
          style={{ width: `${progress}%` }}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>

      {/* Cycling message */}
      <p
        key={step}
        className="mt-5 animate-pulse text-sm font-medium text-[#534AB7]"
        aria-live="polite"
      >
        {LOADING_MESSAGES[step]}
      </p>

      <p className="mt-8 max-w-xs text-xs text-gray-400">
        This usually takes 15–30 seconds. You can come back later and
        it will be ready.
      </p>
    </div>
  );
}

export default ContentGenerationLoading;
