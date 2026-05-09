'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 3: PRACTICE -- Question-by-question MCQ with instant feedback.
 * - Uses usePracticeQuestions hook and normaliseChoices from sessionUtils.
 * - TutorTipPanel shown above questions.
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
 */

import React, { useState, useCallback } from 'react';
import type { PracticeContent } from '@/lib/session/getPhaseContent';
import type { SubmitActionResult } from '@/lib/session/sessionActions';
import { normaliseChoices } from '@/lib/session/sessionUtils';
import { scoreBgColour } from '@/lib/session/sessionUtils';
import { TutorTipPanel } from '@/components/session/TutorTipPanel';

interface PracticePhaseProps {
  content: PracticeContent;
  topicName?: string;
  onSubmit: (
    answers: { questionId: string; answer: string }[]
  ) => Promise<SubmitActionResult | null>;
  onReadyToProceed: (ready: boolean) => void;
  submitting?: boolean;
}

// ─── Results screen ───────────────────────────────────────────────────────────

function ResultsScreen({ result }: { result: SubmitActionResult }) {
  const pct = result.percentage;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center">
        <div className="text-4xl mb-2">{pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪'}</div>
        <h2 className="text-xl font-bold text-foreground">
          {pct >= 80 ? 'Well done!' : pct >= 60 ? 'Good effort!' : 'Keep going!'}
        </h2>
      </div>

      <div className="bg-card rounded-xl border p-5 text-center">
        <div className="text-4xl font-bold text-foreground mb-1">{pct}%</div>
        <p className="text-sm text-muted-foreground">
          {result.correctAnswers} of {result.totalAnswers} correct
        </p>
        <div className="mt-3 w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${scoreBgColour(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
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
}: PracticePhaseProps) {
  const questions = content.questions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; answer: string }[]>([]);
  const [result, setResult] = useState<SubmitActionResult | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  React.useEffect(() => {
    onReadyToProceed(!!result);
  }, [result, onReadyToProceed]);

  const handleAnswer = useCallback(
    async (questionId: string, answer: string) => {
      const question = questions[currentIndex];
      const questionChoices = normaliseChoices(question.choices);
      const isCorrect = isAnswerCorrectForFeedback(
        question as { correctAnswer?: string | null },
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
    return <ResultsScreen result={result} />;
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
  const selected = null; // selection state lives in handleAnswer flow

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

        <p className="text-base font-medium text-foreground mb-5 leading-relaxed">
          {question.prompt}
        </p>

        {choices.length > 0 ? (
          <div className="space-y-2.5">
            {choices.map((choice) => (
              <button
                key={choice.key}
                onClick={() => handleAnswer(question.id, choice.key)}
                disabled={selected !== null}
                className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99] transition-all text-sm"
              >
                <span className="font-mono text-xs mr-2 uppercase text-muted-foreground">
                  {choice.key})
                </span>
                {choice.label}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="text"
            placeholder="Type your answer..."
            onBlur={(e) => {
              if (e.target.value.trim()) handleAnswer(question.id, e.target.value.trim());
            }}
            className="w-full px-4 py-3 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        )}

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