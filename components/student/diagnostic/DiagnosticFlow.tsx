'use client';

/**
 * DiagnosticFlow -- v2 full-screen diagnostic test component
 *
 * Renders as a fixed overlay (z-[100]) covering the StudentNav.
 * Two phases:
 *   1. Active quiz  -- one question at a time, 30-min countdown timer
 *   2. Results view -- knowledge map (no numeric score, colour bands only)
 *
 * Supports:
 *   - Resume from partial Redis state (initialAnswers / initialIndex)
 *   - "Save and continue later" → POST /api/student/diagnostic/save-partial
 *   - Auto-save and submit at timer 0:00
 *   - Abandon guard (beforeunload + in-app confirm dialog)
 *   - Timer: amber + warning text at 2:00 remaining
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiagnosticQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctAnswer: string;
  chapterId: string;
  chapterName: string;
  topicId: string;
};

type PartialAnswer = {
  questionId: string;
  selectedOption: string;
  timeSpentMs: number;
};

type ChapterResult = {
  chapterId: string;
  chapterName: string;
  avgMastery: number;
  questionCount: number;
};

interface DiagnosticFlowProps {
  subjectId: string;
  subjectName: string;
  questions: DiagnosticQuestion[];
  initialAnswers: Array<{ questionId: string; selectedOption: string }>;
  initialIndex: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_SECONDS = 30 * 60; // 30 minutes
const AMBER_THRESHOLD = 2 * 60; // 2 minutes remaining → amber warning

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Check if the student's selected option is correct.
 * Handles both: correctAnswer = full option text, or correctAnswer = numeric index string.
 */
function checkCorrect(question: DiagnosticQuestion, selectedOption: string): boolean {
  const { correctAnswer, choices } = question;
  if (correctAnswer === selectedOption) return true;
  // Try numeric index fallback
  const idx = parseInt(correctAnswer, 10);
  if (!isNaN(idx) && idx >= 0 && idx < choices.length) {
    return choices[idx] === selectedOption;
  }
  return false;
}

/**
 * Compute per-chapter mastery from submitted answers.
 * unanswered = 0.3, correct = 0.6, wrong = 0.15
 */
function computeChapterResults(
  questions: DiagnosticQuestion[],
  answers: PartialAnswer[],
): ChapterResult[] {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const chapterMap = new Map<
    string,
    { chapterName: string; correct: number; wrong: number; unanswered: number }
  >();

  for (const q of questions) {
    if (!chapterMap.has(q.chapterId)) {
      chapterMap.set(q.chapterId, {
        chapterName: q.chapterName,
        correct: 0,
        wrong: 0,
        unanswered: 0,
      });
    }
    const stat = chapterMap.get(q.chapterId)!;
    const ans = answerMap.get(q.id);
    if (!ans) {
      stat.unanswered += 1;
    } else if (checkCorrect(q, ans.selectedOption)) {
      stat.correct += 1;
    } else {
      stat.wrong += 1;
    }
  }

  const results: ChapterResult[] = [];
  for (const [chapterId, stat] of chapterMap) {
    const total = stat.correct + stat.wrong + stat.unanswered;
    if (total === 0) continue;
    const avgMastery =
      (stat.correct * 0.6 + stat.wrong * 0.15 + stat.unanswered * 0.3) / total;
    results.push({ chapterId, chapterName: stat.chapterName, avgMastery, questionCount: total });
  }

  // Sort by mastery ascending (weakest first -- "Start here" = first)
  results.sort((a, b) => a.avgMastery - b.avgMastery);
  return results;
}

function masteryBadge(avgMastery: number): { label: string; colorClass: string } {
  if (avgMastery > 0.7)
    return { label: 'Strong', colorClass: 'bg-[#EAF3DE] text-[#1D9E75]' };
  if (avgMastery >= 0.4)
    return { label: 'Partial', colorClass: 'bg-[#FAEEDA] text-[#BA7517]' };
  return { label: 'Needs work', colorClass: 'bg-[#FCEBEB] text-[#E24B4A]' };
}

// ── AbandonDialog ─────────────────────────────────────────────────────────────

function AbandonDialog({
  onSave,
  onAbandon,
  onCancel,
  busy,
}: {
  onSave: () => void;
  onAbandon: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
          Leave the diagnostic?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Your progress is saved for 24 hours -- you can pick up where you left off.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] disabled:opacity-60 transition-colors"
          >
            {busy ? 'Saving...' : 'Save progress and leave'}
          </button>
          <button
            type="button"
            onClick={onAbandon}
            disabled={busy}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-[#E24B4A] text-[#E24B4A] text-sm font-medium hover:bg-[#FCEBEB] dark:hover:bg-[#E24B4A]/10 disabled:opacity-50 transition-colors"
          >
            Abandon -- progress will be lost
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            Continue diagnostic
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KnowledgeMapResults ───────────────────────────────────────────────────────

function KnowledgeMapResults({
  subjectName,
  results,
}: {
  subjectName: string;
  results: ChapterResult[];
}) {
  const router = useRouter();
  const startHere = results[0]; // weakest chapter (sorted ascending)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8 flex flex-col">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#534AB7] flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#534AB7]/30">
            <span className="text-white font-bold text-lg leading-none">S</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Your knowledge map
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Here&apos;s where you stand in {subjectName} -- no score, just your starting point.
          </p>
        </div>

        {/* Start here card */}
        {startHere && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 border-l-[#534AB7]">
            <div className="p-4">
              <p className="text-xs font-semibold text-[#534AB7] uppercase tracking-wide mb-1">
                Start here
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {startHere.chapterName}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                This chapter needs the most attention -- Teacher Vidya will start here.
              </p>
            </div>
          </div>
        )}

        {/* Chapter list */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm divide-y divide-gray-100 dark:divide-slate-800">
          {results.map((chapter) => {
            const badge = masteryBadge(chapter.avgMastery);
            return (
              <div
                key={chapter.chapterId}
                className="flex items-center justify-between gap-3 px-4 min-h-[52px] py-3"
              >
                <p className="text-sm text-gray-800 dark:text-gray-200 flex-1 leading-snug">
                  {chapter.chapterName}
                </p>
                <span
                  className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${badge.colorClass}`}
                >
                  {badge.label}
                </span>
              </div>
            );
          })}
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              No chapter data yet.
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] transition-all shadow-md shadow-[#534AB7]/25"
        >
          Start learning →
        </button>
      </div>
    </div>
  );
}

// ── Main DiagnosticFlow ───────────────────────────────────────────────────────

export default function DiagnosticFlow({
  subjectId,
  subjectName,
  questions,
  initialAnswers,
  initialIndex,
}: DiagnosticFlowProps) {
  const router = useRouter();

  // Convert initialAnswers (no timeSpentMs) to PartialAnswer
  const [answers, setAnswers] = useState<PartialAnswer[]>(() =>
    initialAnswers.map((a) => ({ ...a, timeSpentMs: 0 })),
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [showAbandon, setShowAbandon] = useState(false);
  const [savingPartial, setSavingPartial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [phase, setPhase] = useState<'quiz' | 'results'>('quiz');
  const [chapterResults, setChapterResults] = useState<ChapterResult[]>([]);

  const questionStartRef = useRef(Date.now());
  const finalAnswersRef = useRef<PartialAnswer[]>(answers);

  // Keep ref in sync for timer auto-submit
  useEffect(() => {
    finalAnswersRef.current = answers;
  }, [answers]);

  // Pre-fill selection if resuming
  useEffect(() => {
    const existing = answers.find((a) => a.questionId === questions[currentIndex]?.id);
    setSelectedOption(existing?.selectedOption ?? '');
    questionStartRef.current = Date.now();
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'quiz') return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-submit with current answers
          submitDiagnostic(finalAnswersRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Abandon guard (beforeunload) ──────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'quiz') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const recordAnswer = useCallback(
    (option: string): PartialAnswer[] => {
      const timeSpentMs = Date.now() - questionStartRef.current;
      const questionId = questions[currentIndex].id;
      const updated = answers.filter((a) => a.questionId !== questionId);
      updated.push({ questionId, selectedOption: option, timeSpentMs });
      return updated;
    },
    [answers, currentIndex, questions],
  );

  async function savePartial(currentAnswers: PartialAnswer[]): Promise<void> {
    setSavingPartial(true);
    try {
      await fetch('/api/student/diagnostic/save-partial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          answers: currentAnswers.map(({ questionId, selectedOption: sel }) => ({
            questionId,
            selectedOption: sel,
          })),
          currentIndex,
        }),
      });
    } finally {
      setSavingPartial(false);
    }
  }

  async function submitDiagnostic(finalAnswers: PartialAnswer[]): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/student/diagnostic/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          answers: finalAnswers,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSubmitError(json?.error ?? 'Could not submit. Please try again.');
        setSubmitting(false);
        return;
      }
      // Compute chapter results from local data and switch to results view
      const results = computeChapterResults(questions, finalAnswers);
      setChapterResults(results);
      setPhase('results');
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
      setSubmitting(false);
    }
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  function handleSelectOption(option: string) {
    setSelectedOption(option);
  }

  function handleNext() {
    if (!selectedOption) return;
    const updatedAnswers = recordAnswer(selectedOption);
    setAnswers(updatedAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption('');
      questionStartRef.current = Date.now();
    } else {
      // Last question -- submit
      submitDiagnostic(updatedAnswers);
    }
  }

  async function handleSaveAndLeave() {
    const updatedAnswers = selectedOption ? recordAnswer(selectedOption) : answers;
    await savePartial(updatedAnswers);
    router.push('/dashboard');
  }

  function handleAbandon() {
    router.push('/dashboard');
  }

  // ── Results phase ─────────────────────────────────────────────────────────

  if (phase === 'results') {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-50 dark:bg-slate-950">
        <KnowledgeMapResults subjectName={subjectName} results={chapterResults} />
      </div>
    );
  }

  // ── Quiz phase ────────────────────────────────────────────────────────────

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const progressPct = Math.round(((currentIndex + 1) / questions.length) * 100);
  const isLast = currentIndex === questions.length - 1;
  const isAmber = secondsLeft <= AMBER_THRESHOLD;

  return (
    <>
      {/* Abandon confirm dialog */}
      {showAbandon && (
        <AbandonDialog
          onSave={handleSaveAndLeave}
          onAbandon={handleAbandon}
          onCancel={() => setShowAbandon(false)}
          busy={savingPartial}
        />
      )}

      {/* Full-screen overlay -- covers StudentNav */}
      <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-slate-950 overflow-y-auto">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 px-4 pt-safe-top">

          {/* Progress bar */}
          <div className="h-1 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-[#534AB7] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between py-3 gap-3">
            {/* Question counter */}
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">
              Question{' '}
              <span className="text-gray-900 dark:text-gray-100 font-bold">
                {currentIndex + 1}
              </span>{' '}
              of ~{questions.length}
            </p>

            {/* Timer */}
            <div
              className={`flex items-center gap-1.5 text-sm font-mono font-semibold shrink-0 transition-colors ${
                isAmber
                  ? 'text-[#BA7517]'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
              aria-live="polite"
              aria-label={`Time remaining: ${formatTime(secondsLeft)}`}
            >
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {formatTime(secondsLeft)}
              {isAmber && (
                <span className="text-xs font-normal ml-1 text-[#BA7517]">-- finishing soon</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Question card ─────────────────────────────────────────────────── */}
        <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full flex flex-col gap-5">

          {/* Subject + chapter badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/15 px-2.5 py-1 rounded-full">
              {subjectName}
            </span>
            {currentQuestion.chapterName && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                {currentQuestion.chapterName}
              </span>
            )}
          </div>

          {/* Question text */}
          <div className="text-gray-900 dark:text-gray-100 text-[15px] leading-7 font-medium whitespace-pre-wrap">
            {currentQuestion.prompt}
          </div>

          {/* MCQ options */}
          <div className="flex flex-col gap-3" role="radiogroup" aria-label="Answer options">
            {currentQuestion.choices.map((choice, idx) => {
              const isSelected = selectedOption === choice;
              return (
                <button
                  key={idx}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectOption(choice)}
                  className={[
                    'w-full min-h-[52px] px-4 py-3 rounded-xl border-2 text-left text-sm leading-snug transition-all',
                    isSelected
                      ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300 font-medium'
                      : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 hover:border-[#534AB7]/40 hover:bg-[#EEEDFE]/30 dark:hover:bg-[#534AB7]/5',
                  ].join(' ')}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          {/* Submit error */}
          {submitError && (
            <p role="alert" className="text-xs text-[#E24B4A] dark:text-red-400">
              {submitError}
            </p>
          )}
        </div>

        {/* ── Bottom actions ────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 px-4 py-4 flex flex-col gap-3 pb-safe-bottom">
          <button
            type="button"
            onClick={handleNext}
            disabled={!selectedOption || submitting}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-50 transition-all shadow-md shadow-[#534AB7]/25"
          >
            {submitting ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Submitting...
              </>
            ) : isLast ? (
              'Submit diagnostic →'
            ) : (
              'Next question →'
            )}
          </button>

          {/* Plain text link -- saves directly without a confirm dialog */}
          <button
            type="button"
            onClick={handleSaveAndLeave}
            disabled={submitting || savingPartial}
            className="flex w-full min-h-[44px] items-center justify-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            {savingPartial ? 'Saving...' : 'Save and continue later'}
          </button>
        </div>
      </div>
    </>
  );
}
