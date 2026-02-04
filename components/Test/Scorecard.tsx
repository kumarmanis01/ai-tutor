/**
 * FILE OBJECTIVE:
 * - Display test results with instant feedback including explanations for each question.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Test/Scorecard.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | enhanced with QuestionFeedback and explanations for MVP
 */

"use client";

import React, { useState } from 'react';
import QuestionFeedback from './QuestionFeedback';

interface GradedQuestion {
  attemptQuestionId: string;
  questionId: string;
  questionText?: string;
  userAnswer?: string;
  correctAnswer?: string;
  correct: boolean;
  partial?: boolean;
  explanation?: string;
  type?: 'mcq' | 'short_answer' | 'numeric';
  choices?: Array<{ key: string; label: string }>;
}

interface ScorecardResult {
  scorePercent?: number;
  earnedPoints?: number;
  totalPoints?: number;
  graded?: GradedQuestion[];
}

/**
 * Scorecard
 *
 * Displays summary of grading results returned by `/api/tests/submit`.
 * Now includes instant feedback with explanations for each question.
 */
export default function Scorecard(props: { result: ScorecardResult }) {
  const r = props.result ?? {};
  const [showDetails, setShowDetails] = useState(true);
  
  const graded = r.graded ?? [];
  const correctCount = graded.filter((g) => g.correct).length;
  const partialCount = graded.filter((g) => g.partial && !g.correct).length;
  const wrongCount = graded.length - correctCount - partialCount;

  // Calculate performance message
  const scorePercent = r.scorePercent ?? 0;
  const performanceMessage = scorePercent >= 80 
    ? '🎉 Excellent work!' 
    : scorePercent >= 60 
    ? '👍 Good job! Keep practicing.' 
    : '💪 Keep learning! Review the explanations below.';

  return (
    <div className="mt-4 space-y-4">
      {/* Summary Card */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        {/* Score Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 text-white">
          <h3 className="text-xl font-bold">Test Complete!</h3>
          <p className="text-indigo-100 mt-1">{performanceMessage}</p>
        </div>
        
        {/* Score Details */}
        <div className="p-6">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {Math.round(scorePercent)}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Score</div>
            </div>
            <div className="h-12 w-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {r.earnedPoints ?? 0} / {r.totalPoints ?? 0}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Points</div>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-gray-600 dark:text-gray-300">{correctCount} Correct</span>
            </div>
            {partialCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="text-gray-600 dark:text-gray-300">{partialCount} Partial</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-gray-600 dark:text-gray-300">{wrongCount} Wrong</span>
            </div>
          </div>
        </div>
      </div>

      {/* Question Breakdown Toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {showDetails ? 'Hide' : 'Show'} Question Details
        </span>
        <span className={`transition-transform ${showDetails ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Detailed Question Feedback */}
      {showDetails && graded.length > 0 && (
        <div className="space-y-3">
          {graded.map((g, i) => (
            <QuestionFeedback
              key={g.attemptQuestionId || i}
              questionNumber={i + 1}
              questionText={g.questionText || `Question ${i + 1}`}
              userAnswer={g.userAnswer}
              correctAnswer={g.correctAnswer || ''}
              isCorrect={g.correct}
              isPartial={g.partial}
              explanation={g.explanation}
              type={g.type}
              choices={g.choices}
            />
          ))}
        </div>
      )}
    </div>
  );
}
