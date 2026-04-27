/**
 * FILE OBJECTIVE:
 * - Display instant feedback for a single question with correct/incorrect indicator,
 *   correct answer reveal, and explanation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Test/QuestionFeedback.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created for MVP instant feedback
 */

'use client';

import React from 'react';

export interface QuestionFeedbackProps {
  questionNumber: number;
  questionText: string;
  userAnswer?: string;
  correctAnswer: string;
  isCorrect: boolean;
  isPartial?: boolean;
  explanation?: string;
  type?: 'mcq' | 'short_answer' | 'numeric';
  choices?: Array<{ key: string; label: string }>;
}

/**
 * QuestionFeedback - Displays instant feedback for a single answered question.
 * Shows correct/incorrect status, the correct answer, and explanation.
 */
export default function QuestionFeedback({
  questionNumber,
  questionText,
  userAnswer,
  correctAnswer,
  isCorrect,
  isPartial,
  explanation,
  type = 'short_answer',
  choices,
}: QuestionFeedbackProps) {
  // Determine the status color and icon
  const statusConfig = isCorrect
    ? { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', icon: '✓', color: 'text-green-600 dark:text-green-400', label: 'Correct!' }
    : isPartial
    ? { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', icon: '◐', color: 'text-yellow-600 dark:text-yellow-400', label: 'Partial' }
    : { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: '✗', color: 'text-red-600 dark:text-red-400', label: 'Incorrect' };

  // Format the correct answer for display
  const formatAnswer = (answer: string) => {
    if (type === 'mcq' && choices) {
      const choice = choices.find((c) => c.key === answer);
      return choice ? `${answer}: ${choice.label}` : answer;
    }
    return answer;
  };

  return (
    <div className={`rounded-lg border ${statusConfig.border} ${statusConfig.bg} p-4 transition-all`}>
      {/* Header with question number and status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2 flex-1">
          <span className="flex-shrink-0 text-sm font-semibold text-muted-foreground">
            Q{questionNumber}
          </span>
          <p className="text-foreground">{questionText}</p>
        </div>
        <div className={`flex items-center gap-1.5 ${statusConfig.color} font-semibold text-sm flex-shrink-0`}>
          <span className="text-lg">{statusConfig.icon}</span>
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {/* Answer comparison */}
      <div className="mt-3 space-y-2 pl-6">
        {/* User's answer */}
        <div className="flex items-start gap-2 text-sm">
          <span className="text-muted-foreground font-medium min-w-[90px]">Your answer:</span>
          <span className={isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
            {userAnswer || '(no answer)'}
          </span>
        </div>

        {/* Correct answer (shown if wrong) */}
        {!isCorrect && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground font-medium min-w-[90px]">Correct answer:</span>
            <span className="text-green-700 dark:text-green-300 font-medium">
              {formatAnswer(correctAnswer)}
            </span>
          </div>
        )}
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="mt-4 pl-6">
          <div className="rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 p-3">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium text-sm mb-1">
              <span>💡</span>
              <span>Explanation</span>
            </div>
            <p className="text-sm text-blue-900 dark:text-blue-100">{explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
