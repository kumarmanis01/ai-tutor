'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 3: PRACTICE -- Question-by-question MCQ with instant feedback.
 * - Uses usePracticeQuestions hook and normaliseChoices from sessionUtils.
 * - TutorTipPanel shown above questions.
 * - Results screen includes "Practice more" button for paid users to fetch fresh questions once-per-day.
 * - Premium check happens client-side before API call; if not premium, shows UpgradeFlow.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/session/SessionPhases.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | moved to components/session/phases/ + uses hooks/session +
 *                          sessionUtils + TutorTipPanel (closes Gap #14)
 * - 2026-05-09T00:00:00Z | copilot | align local feedback grading with submit API normalization for key/text answers
 * - 2026-05-09T00:00:00Z | copilot | revert UI suppression workaround; rely on API flow to supply correctAnswer
 * - 2026-05-09T00:00:00Z | copilot | replace inline-style score bar with semantic progress element (lint compliance)
 * - 2026-05-11T13:15:00Z | copilot | add "Practice more" button in results screen for once-per-day fresh questions (paid only)
 * - 2026-05-12T00:00:00Z | copilot | check isPremiumUser client-side before practice more API call; show UpgradeFlow if not premium
 * - 2026-05-12T15:45:00Z | copilot | fix: call /api/subscription/status endpoint instead of isPremiumUser to check premium status from client
 * - 2026-05-13T00:00:00Z | copilot | render practice questions through the shared question interaction shell
 * - 2026-05-13T00:00:00Z | copilot | pass bank question IDs into the shared shell so practice inherits question flagging
 */

import React, { useState, useCallback } from 'react';
import type { PracticeContent } from '@/lib/session/getPhaseContent';
import type { SubmitActionResult } from '@/lib/session/sessionActions';
import { normaliseChoices } from '@/lib/session/sessionUtils';
import { scoreBgColour } from '@/lib/session/sessionUtils';
import { TutorTipPanel } from '@/components/session/TutorTipPanel';
import UpgradeFlow from '@/components/student/subscription/UpgradeFlow';
import { QuestionInteractionShell } from '@/components/questions/QuestionInteractionShell';

interface PracticePhaseProps {
  content: PracticeContent;
  topicName?: string;
  onSubmit: (
    answers: { questionId: string; answer: string }[]
  ) => Promise<SubmitActionResult | null>;
  onReadyToProceed: (ready: boolean) => void;
  submitting?: boolean;
  onPracticeMore?: () => Promise<void>;
  practiceMoreLoading?: boolean;
  practiceMoreError?: string | null;
}

// ─── Results screen ───────────────────────────────────────────────────────────

function ResultsScreen({
  result,
  onPracticeMore,
  practiceMoreLoading,
  practiceMoreError,
  showUpgradeFlow,
  onDismissUpgrade,
  onShowUpgradeFlow,
}: {
  result: SubmitActionResult;
  onPracticeMore?: () => Promise<void>;
  practiceMoreLoading?: boolean;
  practiceMoreError?: string | null;
  showUpgradeFlow?: boolean;
  onDismissUpgrade?: () => void;
  onShowUpgradeFlow?: () => void;
}) {
  const pct = result.percentage;
  const [isChecking, setIsChecking] = useState(false);

  const handlePracticeMoreClick = useCallback(async () => {
    if (!onPracticeMore) return;
    setIsChecking(true);
    try {
      // Check premium status via API endpoint
      const response = await fetch('/api/subscription/status');
      const data = (await response.json()) as { isPremium?: boolean };
      setIsChecking(false);

      if (!data.isPremium) {
        onShowUpgradeFlow?.();
        return;
      }

      // User is premium, proceed with API call
      await onPracticeMore();
    } catch {
      setIsChecking(false);
    }
  }, [onPracticeMore, onShowUpgradeFlow]);

  if (showUpgradeFlow) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-background rounded-xl max-w-md w-full max-h-[90vh] overflow-auto">
          <UpgradeFlow />
          <button
            onClick={onDismissUpgrade}
            className="p-4 text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Continue learning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">
          {pct >= 80 ? 'Well done!' : pct >= 60 ? 'Good effort!' : 'Keep going!'}
        </h2>
      </div>

      <div className="bg-card rounded-xl border p-5 text-center">
        <div className="text-4xl font-bold text-foreground mb-1">{pct}%</div>
        <p className="text-sm text-muted-foreground">
          {result.correctAnswers} of {result.totalAnswers} correct
        </p>
        <progress
          className={`mt-3 w-full h-2 rounded-full overflow-hidden ${scoreBgColour(pct)}`}
          value={pct}
          max={100}
          aria-label="Practice score progress"
        />
      </div>

      <div className="space-y-2">
        {result.results.map((r, i) => (
          <div
            key={r.questionId}
            className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
              r.isCorrect
                ? 'bg-green-500/5 border border-green-500/15'
                : 'bg-orange-500/5 border border-orange-500/15'
            }`}
          >
            <span
              className={`font-bold flex-shrink-0 ${r.isCorrect ? 'text-green-600' : 'text-orange-600'}`}
            >
              {r.isCorrect ? '✓' : '✗'}
            </span>
            <span className="text-muted-foreground">Q{i + 1}</span>
            {!r.isCorrect && r.correctAnswer && (
              <span className="text-muted-foreground">
                Correct: <span className="font-medium text-foreground">{r.correctAnswer}</span>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Practice more section -- premium feature */}
      {onPracticeMore && (
        <div className="mt-6 pt-5 border-t border-muted">
          {practiceMoreError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/5 border border-red-500/15 text-sm text-red-600">
              {practiceMoreError}
            </div>
          )}
          <button
            type="button"
            onClick={handlePracticeMoreClick}
            disabled={practiceMoreLoading || isChecking}
            aria-label="Get fresh practice questions"
            className="w-full min-h-[44px] rounded-xl bg-[#534AB7] text-sm font-semibold text-white hover:bg-[#4338a3] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
          >
            {isChecking || practiceMoreLoading ? 'Loading fresh questions...' : 'Practice more'}
          </button>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Get fresh questions to keep learning. Available once per day.
          </p>
        </div>
      )}

      {/* Primary CTA (Continue) is in SessionFooter */}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const FEEDBACK_CORRECT = 'Great job!';
const FEEDBACK_INCORRECT = 'Almost there -- try again.';
const CHOICE_KEY_FIRST_CHAR_CODE = 'a'.charCodeAt(0);

function normalizeAnswerForFeedback(input?: string | null): string {
  return (input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019\u201C\u201D]/g, '"');
}

function isChoiceKey(input: string): boolean {
  return /^[a-d]$/i.test(input.trim());
}

function isAnswerCorrectForFeedback(
  question: { correctAnswer?: string | null },
  studentAnswer: string,
  choices: { key: string; label: string }[]
): boolean {
  const correctAnswer = normalizeAnswerForFeedback(question.correctAnswer);
  const student = normalizeAnswerForFeedback(studentAnswer);

  if (!correctAnswer) return false;
  if (student === correctAnswer) return true;

  if (choices.length === 0) return false;

  // Student sent key (a/b/c/d), stored answer may be option text.
  if (isChoiceKey(student)) {
    const studentIndex = student.charCodeAt(0) - CHOICE_KEY_FIRST_CHAR_CODE;
    const studentChoiceText = choices[studentIndex]?.label;
    if (studentChoiceText && normalizeAnswerForFeedback(studentChoiceText) === correctAnswer) {
      return true;
    }
  }

  // Student sent option text, stored answer may be key.
  if (isChoiceKey(correctAnswer)) {
    const correctIndex = correctAnswer.charCodeAt(0) - CHOICE_KEY_FIRST_CHAR_CODE;
    const correctChoiceText = choices[correctIndex]?.label;
    if (correctChoiceText && student === normalizeAnswerForFeedback(correctChoiceText)) {
      return true;
    }
  }

  return false;
}

export function PracticePhase({
  content,
  topicName: _topicName,
  onSubmit,
  onReadyToProceed,
  submitting: _submitting,
  onPracticeMore,
  practiceMoreLoading,
  practiceMoreError,
}: PracticePhaseProps) {
  const questions = content.questions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; answer: string }[]>([]);
  const [result, setResult] = useState<SubmitActionResult | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showUpgradeFlow, setShowUpgradeFlow] = useState(false);

  React.useEffect(() => {
    onReadyToProceed(!!result);
  }, [result, onReadyToProceed]);

  const handleAnswer = useCallback(
    async (questionId: string, answer: string) => {
      const question = questions[currentIndex];
      const questionChoices = normaliseChoices(question.choices);
      const feedbackQuestion = question as { correctAnswer?: string | null };
      const isCorrect = isAnswerCorrectForFeedback(
        feedbackQuestion,
        answer,
        questionChoices
      );
      setFeedback(isCorrect ? 'correct' : 'incorrect');

      const newAnswers = [...answers, { questionId, answer }];
      setAnswers(newAnswers);
      if (currentIndex < questions.length - 1) {
        setTimeout(() => {
          setFeedback(null);
          setCurrentIndex((i) => i + 1);
        }, 500);
      } else {
        const res = await onSubmit(newAnswers);
        if (res) setResult(res);
      }
    },
    [answers, currentIndex, onSubmit, questions]
  );

  if (result) {
    return (
      <ResultsScreen
        result={result}
        onPracticeMore={onPracticeMore}
        practiceMoreLoading={practiceMoreLoading}
        practiceMoreError={practiceMoreError}
        showUpgradeFlow={showUpgradeFlow}
        onDismissUpgrade={() => setShowUpgradeFlow(false)}
        onShowUpgradeFlow={() => setShowUpgradeFlow(true)}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-muted-foreground text-sm">
        Practice questions are being generated. Come back shortly.
      </div>
    );
  }

  const question = questions[currentIndex];
  const choices = normaliseChoices(question.choices);
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr,minmax(240px,280px)] gap-6 lg:gap-8 max-w-5xl mx-auto px-4 pb-6">
      <main className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground mb-1">Practice Time</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Let&apos;s solve a few questions together.
        </p>

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          {question.difficulty && (
            <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground capitalize">
              {question.difficulty}
            </span>
          )}
        </div>

        <div className="flex gap-1 mb-5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i < currentIndex ? 'bg-primary' : i === currentIndex ? 'bg-primary/50' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <QuestionInteractionShell
          questionId={question.id}
          prompt={question.prompt}
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          difficulty={question.difficulty}
          choices={choices}
          value=""
          onChange={(nextValue) => {
            if (choices.length > 0) {
              void handleAnswer(question.id, nextValue);
            }
          }}
          onTextCommit={(nextValue) => {
            void handleAnswer(question.id, nextValue);
          }}
          disabled={feedback !== null}
        />

        {feedback !== null && (
          <p
            className={`mt-4 py-3 px-4 rounded-xl text-sm font-medium ${
              feedback === 'correct'
                ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
            }`}
          >
            {feedback === 'correct' ? FEEDBACK_CORRECT : FEEDBACK_INCORRECT}
          </p>
        )}
      </main>
      <aside className="order-first md:order-none md:sticky md:top-24 self-start">
        <TutorTipPanel tipText="Don't worry if you make mistakes. Practice helps learning." />
      </aside>
    </div>
  );
}

export default PracticePhase;