'use client';
/**
 * FILE OBJECTIVE:
 * - Full homework test-taking UI: renders questions, tracks answers, submits,
 *   shows graded results with explanations.
 * - Integrates DoubtPanel so student can ask Vidya mid-homework.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/questions/QuestionInteractionShell.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created -- closes homework test-taking gap
 * - 2026-05-13T00:00:00Z | copilot | render homework questions through the shared question interaction shell
 * - 2026-05-13T00:00:00Z | copilot | pass bank question IDs into the shared shell so homework inherits question flagging
 */

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { DoubtPanel } from '@/components/session/DoubtPanel';
import useCurrentUser from '@/hooks/useCurrentUser';
import { QuestionInteractionShell, type QuestionShellChoice } from '@/components/questions/QuestionInteractionShell';

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

function toShellChoices(raw: unknown): QuestionShellChoice[] {
  const choices = parseChoices(raw);
  if (!choices) return [];

  return choices.map((choice, index) => ({
    key: String.fromCharCode(97 + index),
    label: choice,
  }));
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
  const diff = difficultyLabel(question.difficulty);
  const choices = toShellChoices(question.choices);
  const submittedAnswerLabel =
    gradedAnswer?.studentAnswer && choices.length > 0
      ? choices.find(
          (choice) =>
            choice.key.toLowerCase() === gradedAnswer.studentAnswer.toLowerCase() ||
            choice.label === gradedAnswer.studentAnswer,
        )?.label ?? gradedAnswer.studentAnswer
      : gradedAnswer?.studentAnswer;
  const correctAnswerLabel =
    question.correctAnswer && choices.length > 0
      ? choices.find(
          (choice) =>
            choice.key.toLowerCase() === question.correctAnswer?.toLowerCase() ||
            choice.label === question.correctAnswer,
        )?.label ?? question.correctAnswer
      : question.correctAnswer;

  return (
    <QuestionInteractionShell
      questionId={question.id}
      prompt={question.prompt}
      questionNumber={index + 1}
      totalQuestions={total}
      difficulty={diff.label.toLowerCase()}
      choices={choices}
      value={answer}
      onChange={(nextValue) => !showResult && onAnswer(question.id, nextValue)}
      disabled={showResult}
      showResult={showResult && !!gradedAnswer}
      isCorrect={gradedAnswer?.isCorrect}
      submittedAnswerLabel={submittedAnswerLabel}
      correctAnswerLabel={correctAnswerLabel}
      explanation={question.explanation}
    />
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
  const [isDoubtOpen, setIsDoubtOpen] = useState(false);

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

  const { data: currentUser } = useCurrentUser();

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
            <progress
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted text-[#534AB7]"
              value={questions.length ? (answeredCount / questions.length) * 100 : 0}
              max={100}
              aria-label="Homework answer progress"
            />
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
            {/*<Link
              href="/learn/learning-path"
              className="w-full min-h-[48px] rounded-2xl border border-[#534AB7] text-[#534AB7] dark:text-indigo-300 font-semibold text-sm flex items-center justify-center hover:bg-[#EEEDFE] transition-colors"
            >
              Continue Learning
            </Link>*/}
          </div>
        )}
      </div>

      {/* Floating doubt panel -- always present */}
      <DoubtPanel
        subject={subject}
        chapter={chapter}
        topicName={topicName}
        studentName={currentUser?.name ?? undefined}
        isOpen={isDoubtOpen}
        onClose={() => setIsDoubtOpen(false)}
      />
    </div>
  );
}

export default HomeworkTest;
