'use client';
/**
 * FILE OBJECTIVE:
 * - Full homework test-taking UI: renders questions, tracks answers, submits,
 *   shows graded results with explanations.
 * - Integrates DoubtPanel so student can ask Vidya mid-homework.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created -- closes homework test-taking gap
 */

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { DoubtPanel } from '@/components/session/DoubtPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomeworkQuestion {
  id: string;
  type: string;
  prompt: string;
  choices: unknown;
  difficulty: string | null;
  // Only present after grading
  correctAnswer?: string | null;
  explanation?: string | null;
}

interface GradedAnswer {
  studentAnswer: string;
  isCorrect: boolean;
}

interface SubmitResult {
  score: number;
  percentage: number;
  totalQuestions: number;
  correctAnswers: number;
  results: { questionId: string; isCorrect: boolean; correctAnswer: string | null }[];
}

export interface HomeworkTestProps {
  assignmentId: string;
  questions: HomeworkQuestion[];
  status: string;
  dueDate: string;
  score: number | null;
  /** Pre-filled answers when assignment is already graded */
  answers: Record<string, GradedAnswer>;
  topicName: string;
  chapter: string;
  subject: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseChoices(raw: unknown): string[] | null {
  if (Array.isArray(raw) && raw.every((c) => typeof c === 'string')) return raw as string[];
  return null;
}

function difficultyLabel(d: string | null) {
  if (d === 'easy') return { label: 'Easy', cls: 'bg-[#EAF3DE] text-[#1D9E75]' };
  if (d === 'hard') return { label: 'Hard', cls: 'bg-[#FCEBEB] text-[#E24B4A]' };
  return { label: 'Medium', cls: 'bg-[#FAEEDA] text-[#BA7517]' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  total,
  answer,
  onAnswer,
  gradedAnswer,
  showResult,
}: {
  question: HomeworkQuestion;
  index: number;
  total: number;
  answer: string;
  onAnswer: (qId: string, val: string) => void;
  gradedAnswer?: GradedAnswer;
  showResult: boolean;
}) {
  const choices = parseChoices(question.choices);
  const isMCQ = choices !== null && choices.length > 0;
  const diff = difficultyLabel(question.difficulty);

  const resultBorder = !showResult
    ? 'border-border'
    : gradedAnswer?.isCorrect
      ? 'border-[#1D9E75]'
      : 'border-[#E24B4A]';

  return (
    <div className={`rounded-2xl border-2 ${resultBorder} bg-card p-5 space-y-4 transition-colors`}>
      {/* Question header */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold text-muted-foreground">
          Q{index + 1} / {total}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${diff.cls}`}>
          {diff.label}
        </span>
      </div>

      <p className="text-sm font-medium text-foreground leading-relaxed">{question.prompt}</p>

      {/* Answer input */}
      {isMCQ ? (
        <div className="space-y-2">
          {choices.map((choice, ci) => {
            const optKey = String.fromCharCode(65 + ci); // A, B, C, D
            const isSelected = answer === optKey || answer === choice;
            const isCorrectChoice =
              showResult &&
              question.correctAnswer &&
              (question.correctAnswer === optKey || question.correctAnswer === choice);
            const isWrongSelection = showResult && isSelected && !gradedAnswer?.isCorrect;

            return (
              <label
                key={ci}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors min-h-[44px] ${
                  isCorrectChoice
                    ? 'bg-[#EAF3DE] border-[#1D9E75]'
                    : isWrongSelection
                      ? 'bg-[#FCEBEB] border-[#E24B4A]'
                      : isSelected
                        ? 'bg-[#EEEDFE] border-[#534AB7]'
                        : 'border-border hover:bg-muted/50'
                } ${showResult ? 'cursor-default' : ''}`}
              >
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  value={optKey}
                  checked={isSelected}
                  onChange={() => !showResult && onAnswer(question.id, optKey)}
                  disabled={showResult}
                  className="sr-only"
                />
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                    isCorrectChoice
                      ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
                      : isWrongSelection
                        ? 'bg-[#E24B4A] border-[#E24B4A] text-white'
                        : isSelected
                          ? 'bg-[#534AB7] border-[#534AB7] text-white'
                          : 'border-border text-muted-foreground'
                  }`}
                >
                  {optKey}
                </span>
                <span className="text-sm text-foreground">{choice}</span>
                {isCorrectChoice && (
                  <svg className="ml-auto w-4 h-4 text-[#1D9E75] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </label>
            );
          })}
        </div>
      ) : (
        <textarea
          rows={2}
          value={answer}
          onChange={(e) => !showResult && onAnswer(question.id, e.target.value)}
          disabled={showResult}
          placeholder="Type your answer here..."
          className={`w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7]/40 disabled:bg-muted/30 ${
            showResult && gradedAnswer?.isCorrect
              ? 'border-[#1D9E75] bg-[#EAF3DE]'
              : showResult && !gradedAnswer?.isCorrect
                ? 'border-[#E24B4A] bg-[#FCEBEB]'
                : 'border-border'
          }`}
        />
      )}

      {/* Result feedback */}
      {showResult && gradedAnswer && (
        <div className={`rounded-xl p-3 text-sm ${gradedAnswer.isCorrect ? 'bg-[#EAF3DE]' : 'bg-[#FCEBEB]'}`}>
          <p className={`font-semibold mb-1 ${gradedAnswer.isCorrect ? 'text-[#1D9E75]' : 'text-[#E24B4A]'}`}>
            {gradedAnswer.isCorrect ? 'Correct!' : `Incorrect -- you answered: ${gradedAnswer.studentAnswer}`}
          </p>
          {!gradedAnswer.isCorrect && question.correctAnswer && (
            <p className="text-foreground/80 text-xs">
              Correct answer: <span className="font-semibold">{question.correctAnswer}</span>
            </p>
          )}
          {question.explanation && (
            <p className="text-foreground/70 text-xs mt-1 leading-relaxed">{question.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBanner({ percentage }: { percentage: number }) {
  const isStrong = percentage >= 80;
  const isOk = percentage >= 50;

  const { bg, textColor, message } = isStrong
    ? {
        bg: 'bg-[#EAF3DE] border-[#1D9E75]',
        textColor: 'text-[#1D9E75]',
        message: 'Great work! Keep this up.',
      }
    : isOk
      ? {
          bg: 'bg-[#FAEEDA] border-[#BA7517]',
          textColor: 'text-[#BA7517]',
          message: 'Good effort -- review the explanations below.',
        }
      : {
          bg: 'bg-[#FCEBEB] border-[#E24B4A]',
          textColor: 'text-[#E24B4A]',
          message: 'Review these concepts with Teacher Vidya.',
        };

  return (
    <div className={`rounded-2xl border-2 ${bg} p-5 text-center space-y-1`}>
      <p className={`text-3xl font-bold ${textColor}`}>{percentage}%</p>
      <p className="text-sm text-foreground/80 font-medium">{message}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function HomeworkTest({
  assignmentId,
  questions,
  status,
  dueDate,
  score,
  answers: initialAnswers,
  topicName,
  chapter,
  subject,
}: HomeworkTestProps) {
  const isAlreadyGraded = status === 'GRADED' || status === 'SUBMITTED';

  // If pre-graded, seed answers from saved results
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>(() => {
    if (isAlreadyGraded) {
      return Object.fromEntries(
        Object.entries(initialAnswers).map(([qId, a]) => [qId, a.studentAnswer])
      );
    }
    return {};
  });

  const [gradedResults, setGradedResults] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const showResult = isAlreadyGraded || gradedResults !== null;

  const answeredCount = Object.keys(studentAnswers).filter((k) => studentAnswers[k].trim()).length;
  const allAnswered = answeredCount === questions.length;

  const dueLabel = new Date(dueDate).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  const onAnswer = useCallback((qId: string, val: string) => {
    setStudentAnswers((prev) => ({ ...prev, [qId]: val }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/homework/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId,
          answers: Object.entries(studentAnswers).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Submission failed');
      }

      const data = await res.json() as SubmitResult;
      setGradedResults(data);

      // Reload page questions from API to get correctAnswers + explanations
      const detail = await fetch(`/api/homework/${assignmentId}`);
      if (detail.ok) {
        // Page will show results from gradedResults; correctAnswers come from re-fetched data
        // We update question data via window reload to keep state simple
        window.location.reload();
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [allAnswered, submitting, assignmentId, studentAnswers]);

  const displayScore = isAlreadyGraded && score !== null
    ? Math.round(score * 100)
    : gradedResults?.percentage ?? null;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Home</Link>
            <span>/</span>
            <span>{subject}</span>
            <span>/</span>
            <span className="text-foreground font-medium truncate">{topicName}</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-foreground">Homework</h1>
            {!showResult && (
              <span className="text-xs text-muted-foreground">
                {answeredCount}/{questions.length} answered
              </span>
            )}
            {showResult && displayScore !== null && (
              <span className={`text-sm font-bold ${displayScore >= 80 ? 'text-[#1D9E75]' : displayScore >= 50 ? 'text-[#BA7517]' : 'text-[#E24B4A]'}`}>
                {displayScore}%
              </span>
            )}
          </div>
          {!showResult && (
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-[#534AB7] rounded-full transition-all duration-300"
                style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{chapter}</span>
          <span>Due: {dueLabel}</span>
        </div>

        {/* Score banner (post-submit) */}
        {showResult && displayScore !== null && (
          <ScoreBanner percentage={displayScore} />
        )}

        {/* Questions */}
        {questions.length === 0 ? (
          <div className="rounded-2xl border border-[#BA7517]/30 bg-[#FAEEDA] p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-[#BA7517]">No questions available yet</p>
            <p className="text-xs text-foreground/60">
              Teacher Vidya is preparing your homework. Check back in a moment.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center mt-2 text-xs text-[#534AB7] font-semibold hover:underline"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                total={questions.length}
                answer={studentAnswers[q.id] ?? ''}
                onAnswer={onAnswer}
                gradedAnswer={
                  showResult
                    ? (isAlreadyGraded ? initialAnswers[q.id] : undefined)
                    : undefined
                }
                showResult={showResult}
              />
            ))}
          </div>
        )}

        {/* Submit error */}
        {submitError && (
          <div className="rounded-xl bg-[#FCEBEB] border border-[#E24B4A]/30 px-4 py-3 text-sm text-[#E24B4A]">
            {submitError}
          </div>
        )}

        {/* Submit / Done CTAs */}
        {!showResult && questions.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className="w-full min-h-[52px] rounded-2xl bg-[#534AB7] text-white font-semibold text-sm disabled:opacity-40 hover:bg-[#3C3489] transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Homework
                  {!allAnswered && (
                    <span className="text-xs font-normal opacity-80">
                      ({questions.length - answeredCount} left)
                    </span>
                  )}
                </>
              )}
            </button>
            {!allAnswered && (
              <p className="text-xs text-center text-muted-foreground">
                Answer all {questions.length} questions to submit.
              </p>
            )}
          </div>
        )}

        {showResult && (
          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/dashboard"
              className="w-full min-h-[52px] rounded-2xl bg-[#534AB7] text-white font-semibold text-sm flex items-center justify-center hover:bg-[#3C3489] transition-colors"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/learn/learning-path"
              className="w-full min-h-[48px] rounded-2xl border border-[#534AB7] text-[#534AB7] dark:text-indigo-300 font-semibold text-sm flex items-center justify-center hover:bg-[#EEEDFE] transition-colors"
            >
              Continue Learning
            </Link>
          </div>
        )}
      </div>

      {/* Floating doubt panel -- always present */}
      <DoubtPanel subject={subject} chapter={chapter} topicName={topicName} />
    </div>
  );
}

export default HomeworkTest;
