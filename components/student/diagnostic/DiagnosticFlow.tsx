'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────────

export type QuestionOption = { key: string; label: string };

export type LiveQuestion = {
  id: string;
  prompt: string;
  options: (string | QuestionOption)[];
  difficulty?: string | null;
  topicId?: string | null;
};

type AnswerRecord = {
  questionId: string;
  selectedOption: string;
  timeSpentMs: number;
};

type Phase = 'loading' | 'active' | 'submitting' | 'done' | 'error';

interface Props {
  subjectId: string;
  subjectName: string;
  boardSlug: string;
  grade: number | string;
  subjectSlug: string;
  languageCode?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normaliseOptions(raw: (string | QuestionOption)[]): QuestionOption[] {
  return (raw ?? []).map((o, i) => {
    if (typeof o === 'string') return { key: o, label: o };
    if (o && typeof o === 'object' && 'label' in o) return o as QuestionOption;
    return { key: String(i), label: String(o) };
  });
}

const DIFFICULTY_COLOURS: Record<string, string> = {
  easy: 'text-[#1D9E75] bg-[#EAF3DE] dark:bg-[#1D9E75]/15',
  medium: 'text-[#BA7517] bg-[#FAEEDA] dark:bg-[#BA7517]/15',
  hard: 'text-[#E24B4A] bg-[#FCEBEB] dark:bg-[#E24B4A]/15',
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function DiagnosticFlow({
  subjectId,
  subjectName,
  boardSlug,
  grade,
  subjectSlug,
  languageCode,
}: Props) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<LiveQuestion | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const questionStartRef = useRef(Date.now());

  // ── Start diagnostic on mount ──────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const res = await fetch('/api/student/diagnostic/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boardSlug, grade, subjectSlug, languageCode }),
        });
        const data = await res.json().catch(() => ({})) as {
          sessionId?: string;
          firstQuestion?: LiveQuestion | null;
          totalQuestions?: number;
          code?: string;
          error?: string;
        };

        if (cancelled) return;

        if (!res.ok) {
          if (data.code === 'RETAKE_COOLDOWN') {
            setErrorMsg('You have already completed this diagnostic. Retake is available in 30 days.');
          } else {
            setErrorMsg(data.error ?? "Couldn't start the diagnostic. Please try again.");
          }
          setPhase('error');
          return;
        }

        if (!data.sessionId || !data.firstQuestion) {
          setErrorMsg("Couldn't load questions. Please try again.");
          setPhase('error');
          return;
        }

        setSessionId(data.sessionId);
        setCurrentQuestion(data.firstQuestion);
        setTotalQuestions(data.totalQuestions ?? 0);
        questionStartRef.current = Date.now();
        setPhase('active');
      } catch {
        if (!cancelled) {
          setErrorMsg('Network error. Please check your connection.');
          setPhase('error');
        }
      }
    }

    void start();
    return () => { cancelled = true; };
  }, [boardSlug, grade, subjectSlug, languageCode]);

  // ── Submit individual answer and advance ───────────────────────────────────

  const handleNext = useCallback(async () => {
    if (!selectedOption || !currentQuestion || submitting) return;

    const timeSpentMs = Date.now() - questionStartRef.current;
    const answer: AnswerRecord = { questionId: currentQuestion.id, selectedOption, timeSpentMs };
    const updatedAnswers = [...answers, answer];
    setAnswers(updatedAnswers);
    setSubmitting(true);
    setSelectedOption(null);

    try {
      const res = await fetch('/api/student/diagnostic/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, questionId: currentQuestion.id, selectedOption, timeSpentMs }),
      });
      const data = await res.json().catch(() => ({})) as {
        success?: boolean;
        nextQuestion?: LiveQuestion | null;
        stopReason?: string;
      };

      const isComplete = !data.nextQuestion || !!data.stopReason;

      if (isComplete) {
        await finishDiagnostic(updatedAnswers);
        return;
      }

      setCurrentQuestion(data.nextQuestion ?? null);
      setQuestionIndex((i) => i + 1);
      questionStartRef.current = Date.now();
    } catch {
      setErrorMsg("Couldn't submit answer. Please try again.");
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  }, [selectedOption, currentQuestion, submitting, answers, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit full diagnostic ─────────────────────────────────────────────────

  const finishDiagnostic = useCallback(async (finalAnswers: AnswerRecord[]) => {
    setPhase('submitting');
    try {
      await fetch('/api/student/diagnostic/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, answers: finalAnswers }),
      });
      setPhase('done');
      router.push('/student/diagnostics');
    } catch {
      setErrorMsg("Couldn't submit diagnostic. Your progress is saved -- please try again.");
      setPhase('error');
    }
  }, [subjectId, router]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const progress = totalQuestions > 0 ? Math.round(((questionIndex + 1) / totalQuestions) * 100) : 0;

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#534AB7] border-t-transparent animate-spin mb-4" aria-label="Loading" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Preparing your diagnostic...</p>
      </div>
    );
  }

  if (phase === 'submitting') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#534AB7] border-t-transparent animate-spin mb-4" aria-label="Submitting" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Submitting your answers...</p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-[#EAF3DE] dark:bg-[#1D9E75]/20 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" className="w-8 h-8" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Diagnostic complete!</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Redirecting you to your results...</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#FCEBEB] dark:bg-[#E24B4A]/20 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2" className="w-7 h-7" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Something went wrong</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{errorMsg}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const options = normaliseOptions(currentQuestion?.options ?? []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {subjectName}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {questionIndex + 1} / {totalQuestions || '?'}
            </p>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#534AB7] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5 mb-5">
          {currentQuestion?.difficulty && DIFFICULTY_COLOURS[currentQuestion.difficulty] && (
            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-3 capitalize ${DIFFICULTY_COLOURS[currentQuestion.difficulty]}`}>
              {currentQuestion.difficulty}
            </span>
          )}
          <p className="text-base font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
            {currentQuestion?.prompt}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {options.map((opt) => {
            const isSelected = selectedOption === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelectedOption(opt.key)}
                className={[
                  'w-full min-h-[52px] flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                  isSelected
                    ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 hover:border-[#534AB7]/40',
                ].join(' ')}
              >
                <span
                  className={[
                    'shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                    isSelected
                      ? 'border-[#534AB7] bg-[#534AB7]'
                      : 'border-gray-300 dark:border-slate-600',
                  ].join(' ')}
                >
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-white" />
                  )}
                </span>
                <span className="text-sm leading-snug">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 px-4 py-4 safe-area-inset-bottom">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleNext}
            disabled={!selectedOption || submitting}
            className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#534AB7] text-white font-semibold text-base hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-50 transition-all shadow-md shadow-[#534AB7]/25"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden />
                Submitting...
              </>
            ) : (
              'Submit answer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
