"use client";

import React, { useState, useMemo } from 'react';
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

interface DifficultyFeedback {
  changed: boolean;
  newDifficulty: string;
  humanReason: string;
  direction: 'up' | 'down' | 'same';
}

interface ScorecardResult {
  scorePercent?: number;
  earnedPoints?: number;
  totalPoints?: number;
  graded?: GradedQuestion[];
  difficultyFeedback?: DifficultyFeedback | null;
}

/**
 * Scorecard
 *
 * Displays summary of grading results returned by `/api/tests/submit`.
 * Includes difficulty adjustment feedback and skill gap analysis.
 */
export default function Scorecard(props: { result: ScorecardResult }) {
  const r = props.result ?? {};
  const [showDetails, setShowDetails] = useState(true);

  const graded = useMemo(() => r.graded ?? [], [r.graded]);
  const correctCount = graded.filter((g) => g.correct).length;
  const partialCount = graded.filter((g) => g.partial && !g.correct).length;
  const wrongCount = graded.length - correctCount - partialCount;

  const scorePercent = r.scorePercent ?? 0;
  const performanceMessage = scorePercent >= 80
    ? 'Excellent work!'
    : scorePercent >= 60
    ? 'Good job! Keep practicing.'
    : 'Keep learning! Review the explanations below.';

  // Skill gap analysis: group wrong answers by question text patterns
  const skillGaps = useMemo(() => {
    const wrong = graded.filter((g) => !g.correct && !g.partial);
    if (wrong.length === 0) return [];

    // Deduplicate topics from wrong answers
    const topics = new Map<string, number>();
    for (const q of wrong) {
      const text = (q.questionText ?? '').toLowerCase();
      // Extract likely topic keywords (first few meaningful words)
      const words = text.replace(/[^a-z\s]/g, '').split(/\s+/).filter((w) => w.length > 3).slice(0, 3);
      const topicKey = words.join(' ') || 'general concepts';
      topics.set(topicKey, (topics.get(topicKey) ?? 0) + 1);
    }

    return Array.from(topics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic, count]) => ({ topic, count }));
  }, [graded]);

  const diffFeedback = r.difficultyFeedback;

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

      {/* Difficulty Adjustment Feedback */}
      {diffFeedback && (
        <div className={`rounded-lg border px-4 py-3 ${
          diffFeedback.direction === 'up'
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            : diffFeedback.direction === 'down'
            ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
            : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {diffFeedback.direction === 'up' ? '\u2B06\uFE0F' : diffFeedback.direction === 'down' ? '\u2B07\uFE0F' : '\u2796'}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {diffFeedback.changed
                  ? `Difficulty adjusted to ${diffFeedback.newDifficulty}`
                  : `Staying at ${diffFeedback.newDifficulty} difficulty`}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {diffFeedback.humanReason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Skill Gap Analysis */}
      {skillGaps.length > 0 && (
        <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-4 py-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Areas to improve
          </h4>
          <ul className="space-y-1">
            {skillGaps.map((gap, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0"></span>
                <span className="capitalize">{gap.topic}</span>
                <span className="text-xs text-gray-500">({gap.count} {gap.count === 1 ? 'question' : 'questions'} missed)</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Try reviewing these topics in your notes before your next practice.
          </p>
        </div>
      )}

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
