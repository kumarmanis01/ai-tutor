/**
 * FILE OBJECTIVE:
 * - Day-1 Today's Task Screen component.
 * - Answer "Aaj kya karna hai?" - nothing else.
 * - Shows ONE task only with estimated time.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Day1/TodaysTaskScreen.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | copilot | created today's task screen
 */

'use client';

import React from 'react';
import {
  TodaysTaskScreenProps,
  TODAYS_TASK_COPY_HI,
  TODAYS_TASK_COPY_EN,
} from './types';

/**
 * Day-1 Today's Task Screen
 * 
 * UX Rules (FROZEN):
 * - ONE task only
 * - Estimated time visible
 * - No difficulty labels
 * 
 * Purpose: Answer "Aaj kya karna hai?" Nothing else.
 */
export function TodaysTaskScreen({
  task,
  onStartTask,
  language,
}: TodaysTaskScreenProps): React.ReactElement {
  const copy = language === 'hi' ? TODAYS_TASK_COPY_HI : TODAYS_TASK_COPY_EN;

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-white"
      role="main"
      aria-label="Today's task"
    >
      {/* Title - Clear purpose */}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 text-center">
        {copy.title}
      </h1>

      {/* Time indicator - Reduces anxiety */}
      <p className="text-lg text-gray-500 mb-8">
        {copy.subtitle}
      </p>

      {/* Task card - The heart of Day-1 */}
      <div className="w-full max-w-md bg-blue-50 rounded-2xl p-6 mb-8 shadow-sm">
        {/* Task description */}
        <p className="text-lg text-gray-700 mb-4">
          {task.title}
        </p>

        {/* Example preview - Critical for confidence */}
        <div className="bg-white rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-500 mb-2">
            {language === 'hi' ? '📝 Pehle ek example dekhein:' : '📝 First, see an example:'}
          </p>
          <p className="text-gray-700 font-medium">
            {task.example.problem}
          </p>
          <p className="text-green-600 mt-2">
            → {task.example.solution}
          </p>
        </div>

        {/* Question count - Transparent, not scary */}
        <p className="text-sm text-gray-500 text-center">
          {language === 'hi' 
            ? `${task.questions.length} chhote questions` 
            : `${task.questions.length} small questions`}
        </p>
      </div>

      {/* Start button - Single CTA */}
      <button
        onClick={onStartTask}
        className="px-10 py-4 bg-green-500 hover:bg-green-600 text-white text-xl font-semibold rounded-full shadow-lg transform transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300"
        aria-label={copy.cta}
      >
        {copy.cta}
      </button>

      {/* Time reassurance */}
      <p className="mt-6 text-sm text-gray-400">
        {language === 'hi' 
          ? `⏱️ Lagbhag ${task.estimatedMinutes} minute` 
          : `⏱️ About ${task.estimatedMinutes} minutes`}
      </p>
    </div>
  );
}

export default TodaysTaskScreen;
