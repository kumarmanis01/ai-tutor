/**
 * FILE OBJECTIVE:
 * - S2.3 practice flow UI with freemium badge, instant feedback, XP animation, and summary card.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/practice/PracticeFlow.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.3 practice flow and S2.4 freemium wall integration
 * - 2026-04-25T01:15:00Z | copilot | added explicit answer feedback states, review mode, and offline sync status
 * - 2026-04-26T11:20:00Z | copilot | prefix unused restart hook value with underscore for lint compliance
 */

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePractice } from '@/hooks/usePractice';
import FreemiumWallModal from './FreemiumWallModal';

type PracticeFlowProps = {
  studentId: string;
  topicId: string;
};

type AnswerState = 'unanswered' | 'checking' | 'correct' | 'incorrect';

function badgeTone(remaining: number | null): string {
  if (remaining === null) return 'bg-[#EAF3DE] text-[#1D9E75]';
  if (remaining === 0) return 'bg-[#FCEBEB] text-[#E24B4A]';
  if (remaining <= 2) return 'bg-[#FAEEDA] text-[#BA7517]';
  return 'bg-[#EAF3DE] text-[#1D9E75]';
}

export default function PracticeFlow({ studentId, topicId }: PracticeFlowProps) {
  const {
    currentQuestion,
    index,
    isLoading,
    isSubmitting,
    error,
    selectedAnswer,
    setSelectedAnswer,
    submitCurrent,
    nextQuestion,
    score,
    isFinished,
    canShowFreemiumWall,
    remaining,
    restart: _restart,
    results,
    queuedCount,
    syncStatus,
  } = usePractice(studentId, topicId);

  const [showWall, setShowWall] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
  const [showExplanation, setShowExplanation] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  const progressLabel = useMemo(() => {
    if (!currentQuestion) return 'No question loaded';
    return `Question ${index + 1} of 5`;
  }, [currentQuestion, index]);

  const feedback = useMemo(() => {
    if (!currentQuestion) return null;
    return results[index] ?? null;
  }, [currentQuestion, index, results]);

  async function handleSubmit() {
    if (canShowFreemiumWall) {
      setShowWall(true);
      return;
    }

    setAnswerState('checking');
    const response = await submitCurrent();
    if (!response) {
      setAnswerState('unanswered');
      return;
    }

    setShowExplanation(false);
    if (response.result.isCorrect) {
      setAnswerState('correct');
      setShowReward(true);
      window.setTimeout(() => setShowReward(false), 1200);
      return;
    }

    setAnswerState('incorrect');
  }

  function handleNextQuestion() {
    nextQuestion();
    setAnswerState('unanswered');
    setShowExplanation(false);
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="h-8 w-56 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-28 animate-pulse rounded-xl bg-gray-100" />
        <div className="mt-4 h-56 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (isFinished) {
    const mistakes = results.filter((result) => !result.isCorrect);

    if (reviewMode) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-gray-900">Review Mistakes</h1>
              <button
                type="button"
                onClick={() => setReviewMode(false)}
                className="min-h-[44px] rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Back to Summary
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {mistakes.length === 0 && (
                <p className="text-sm text-gray-600">No mistakes to review. You got them all correct.</p>
              )}
              {mistakes.map((mistake) => (
                <article key={mistake.questionId} className="rounded-xl border border-[#FAEEDA] bg-[#FAEEDA]/40 p-4">
                  <p className="text-sm font-semibold text-gray-900">{mistake.question}</p>
                  <p className="mt-2 text-xs text-[#E24B4A]">Your answer: {mistake.answer}</p>
                  <p className="mt-1 text-xs text-[#1D9E75]">Correct answer: {mistake.correctAnswer}</p>
                  <p className="mt-2 text-xs text-gray-600">{mistake.explanation}</p>
                  {mistake.hint && <p className="mt-2 text-xs font-medium text-[#BA7517]">Hint: {mistake.hint}</p>}
                </article>
              ))}
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Practice Summary</h1>
          <p className="mt-2 text-sm text-gray-700">
            Score: {score.correct}/{score.total} ({score.accuracy}% accuracy)
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setReviewMode(true)}
              className="min-h-[44px] rounded-xl border border-[#534AB7] px-4 py-2 text-sm font-semibold text-[#534AB7] hover:bg-[#EEEDFE]"
            >
              Review Mistakes
            </button>
            <Link
              href={`/student/learning-map/topic/${encodeURIComponent(topicId)}`}
              className="min-h-[44px] rounded-xl bg-[#1D9E75] px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Continue Learning
            </Link>
          </div>

          {mistakes.length > 0 && (
            <div className="mt-5 space-y-3">
              {mistakes.map((mistake) => (
                <article key={mistake.questionId} className="rounded-xl border border-[#FAEEDA] bg-[#FAEEDA]/40 p-3">
                  <p className="text-sm font-semibold text-gray-900">{mistake.question}</p>
                  <p className="mt-1 text-xs text-[#BA7517]">Your answer: {mistake.answer}</p>
                  <p className="mt-1 text-xs text-gray-600">Correct answer: {mistake.correctAnswer}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="rounded-xl border border-[#E24B4A] bg-[#FCEBEB] px-4 py-3 text-sm text-[#E24B4A]">
          No practice questions are available for this topic right now.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href={`/student/learning-map/topic/${encodeURIComponent(topicId)}`} className="text-sm font-semibold text-[#534AB7] hover:underline">
          ← Back to Lesson
        </Link>

        {!remaining.isPremium && (
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeTone(remaining.remaining)}`}
            onClick={() => {
              if (canShowFreemiumWall) {
                setShowWall(true);
              }
            }}
          >
            {remaining.remaining ?? 0}/5 Free Questions Left Today
          </button>
        )}
      </div>

      {(queuedCount > 0 || syncStatus === 'syncing' || syncStatus === 'synced') && (
        <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {syncStatus === 'syncing' && 'Syncing offline practice results...'}
          {syncStatus === 'synced' && 'Offline practice results synced.'}
          {syncStatus === 'queued' && `${queuedCount} practice result${queuedCount === 1 ? '' : 's'} queued for sync.`}
        </div>
      )}

      <section
        className={`rounded-2xl border bg-white p-5 shadow-sm transition-colors ${
          answerState === 'correct'
            ? 'border-[#1D9E75] practice-flash-green'
            : answerState === 'incorrect'
              ? 'border-[#E24B4A] practice-flash-red'
              : 'border-gray-200'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{progressLabel}</p>
        <h1 className="mt-2 text-lg font-semibold text-gray-900">{currentQuestion.prompt}</h1>

        <div className="mt-4 space-y-2">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedAnswer === option.key;
            const isCorrectAnswer = feedback?.correctAnswer === option.key;
            const isIncorrectSelection =
              answerState === 'incorrect' && isSelected && feedback?.correctAnswer !== option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedAnswer(option.key)}
                disabled={answerState === 'correct' || answerState === 'incorrect' || isSubmitting}
                className={`min-h-[44px] w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  isCorrectAnswer && (answerState === 'correct' || answerState === 'incorrect')
                    ? 'border-[#1D9E75] bg-[#EAF3DE] text-[#1D9E75]'
                    : isIncorrectSelection
                      ? 'border-[#E24B4A] bg-[#FCEBEB] text-[#E24B4A]'
                      : isSelected
                        ? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
                        : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span className="font-semibold">{option.key}.</span> {option.label}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className={`mt-4 rounded-xl p-4 ${feedback.isCorrect ? 'bg-[#EAF3DE] text-[#1D9E75]' : 'bg-[#FCEBEB] text-[#E24B4A]'}`}>
            <p className="text-sm font-semibold">
              {feedback.isCorrect ? 'Study Buddy: Brilliant! You got it right.' : "Study Buddy: No worries! Here's a hint."}
            </p>
            {!feedback.isCorrect && feedback.hint && (
              <p className="mt-1 text-sm">{feedback.hint}</p>
            )}
            {!feedback.isCorrect && feedback.correctAnswer && (
              <p className="mt-2 text-sm font-medium">Correct answer: {feedback.correctAnswer}</p>
            )}
            <button
              type="button"
              onClick={() => setShowExplanation((prev) => !prev)}
              className="mt-3 min-h-[44px] text-sm font-semibold underline underline-offset-2"
            >
              {showExplanation ? 'Hide explanation' : 'Show explanation'}
            </button>
            {showExplanation && <p className="mt-2 text-sm">{feedback.explanation}</p>}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-[#E24B4A] bg-[#FCEBEB] px-3 py-2 text-xs text-[#E24B4A]">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          {answerState === 'unanswered' || answerState === 'checking' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void handleSubmit();
                }}
                disabled={!selectedAnswer || isSubmitting || canShowFreemiumWall}
                className="min-h-[44px] rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
              >
                {isSubmitting || answerState === 'checking' ? 'Checking...' : 'Submit'}
              </button>

              <p className="text-sm text-gray-600">
                {selectedAnswer ? 'Tap Submit to check your answer.' : 'Choose one option to continue.'}
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleNextQuestion}
                className="min-h-[44px] rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white"
              >
                Next Question →
              </button>
              <p className="text-sm text-gray-600">You control the pace. Review the feedback, then continue.</p>
            </>
          )}
        </div>
      </section>

      {showReward && (
        <div className="pointer-events-none fixed right-6 top-24 z-30 rounded-full bg-[#EAF3DE] px-4 py-2 text-sm font-bold text-[#1D9E75] practice-coin-burst animate-[fadeIn_120ms_ease-out]">
          +10 XP 🎉
        </div>
      )}

      {showWall && (
        <FreemiumWallModal
          studentId={studentId}
          topicId={topicId}
          featureType="practice"
          onClose={() => setShowWall(false)}
        />
      )}
    </div>
  );
}
