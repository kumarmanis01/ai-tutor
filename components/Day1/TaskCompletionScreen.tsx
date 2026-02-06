/**
 * FILE OBJECTIVE:
 * - Day-1 Task Completion Screen component.
 * - Anchor success, not performance.
 * - No scores, no % marks, no correct/incorrect obsession.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Day1/TaskCompletionScreen.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | copilot | created task completion screen
 */

'use client';

import React from 'react';
import {
  TaskCompletionScreenProps,
  COMPLETION_COPY_HI,
  COMPLETION_COPY_EN,
} from './types';

/**
 * Day-1 Task Completion Screen
 * 
 * UX Rules (FROZEN):
 * - No scores
 * - No % marks
 * - No "correct / incorrect" obsession
 * 
 * Critical Psychology:
 * - Completion > Correctness
 * - Builds habit loop
 * - Student exits feeling light, not judged
 */
export function TaskCompletionScreen({
  _studentName,
  onClose,
  language,
}: TaskCompletionScreenProps): React.ReactElement {
  const copy = language === 'hi' ? COMPLETION_COPY_HI : COMPLETION_COPY_EN;

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-green-50 to-white"
      role="main"
      aria-label="Task completed"
    >
      {/* Success checkmark - Visual anchor */}
      <div className="mb-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <svg 
            className="w-12 h-12 text-green-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={3} 
              d="M5 13l4 4L19 7" 
            />
          </svg>
        </div>
      </div>

      {/* Completion header */}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 text-center">
        {copy.header}
      </h1>

      {/* Positive reinforcement - Praise effort, not intelligence */}
      <p className="text-lg text-gray-600 text-center whitespace-pre-line mb-6 max-w-sm">
        {copy.message}
      </p>

      {/* Gentle preview of tomorrow */}
      <p className="text-md text-gray-500 text-center mb-10">
        {copy.secondary}
      </p>

      {/* Close/Finish button */}
      <button
        onClick={onClose}
        className="px-10 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-lg font-semibold rounded-full shadow-sm transform transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-300"
        aria-label={copy.cta}
      >
        {copy.cta}
      </button>

      {/* NO SCORES SHOWN - Intentionally absent */}
      {/* NO CORRECT COUNT - Intentionally absent */}
      {/* NO PERCENTAGE - Intentionally absent */}
    </div>
  );
}

export default TaskCompletionScreen;
