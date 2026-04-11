"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { showAlert } from '@/lib/alerts';
import Scorecard from './Scorecard';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * AttemptRunner
 *
 * Renders a list of questions and collects answers. Submits to
 * `POST /api/tests/submit` and displays `Scorecard` on completion.
 *
 * When `timeLimitSeconds` is provided (chapter tests), shows a countdown
 * timer and auto-submits when time runs out (F-STU-020 AC-03).
 */
export default function AttemptRunner(props: {
  attemptId: string;
  initialQuestions: any[];
  timeLimitSeconds?: number;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<any | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(
    props.timeLimitSeconds ?? null,
  );

  const questions = useMemo(() => props.initialQuestions ?? [], [props.initialQuestions]);

  // Keep latest submit in a ref so the timer effect can call it without stale closure.
  const submitRef = useRef<() => void>(() => {});

  function updateAnswer(qid: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        attemptId: props.attemptId,
        answers: questions.map((q: any) => ({ questionId: q.id, answer: answers[q.id] ?? '' })),
      };
      const res = await fetch('/api/tests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit');
      setScore(json);
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message ?? 'Failed to submit', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  submitRef.current = submit;

  // Countdown timer: tick every second; auto-submit on expiry.
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      submitRef.current();
      return;
    }
    const id = setInterval(() => setTimeLeft((t) => (t !== null ? Math.max(0, t - 1) : null)), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  if (score) return <Scorecard result={score} />;

  const isLow = timeLeft !== null && timeLeft <= 60;

  return (
    <div className="mt-4 rounded-lg border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Practice Attempt</h3>
        <div className="flex items-center gap-3">
          {timeLeft !== null && (
            <span
              className={`font-mono text-sm font-semibold px-2 py-1 rounded ${
                isLow ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {formatTime(timeLeft)}
            </span>
          )}
          <button
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Answers'}
          </button>
        </div>
      </div>
      <ol className="mt-3 space-y-4">
        {questions.map((q: any, idx: number) => {
          const qtype = (q.type ?? '').toLowerCase();
          return (
            <li key={q.id} className="rounded border p-3">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-500">Q{idx + 1}</span>
                <p className="text-gray-900">{q.prompt}</p>
              </div>
              {qtype === 'mcq' && Array.isArray(q.choices) && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {q.choices.map((c: any, i: number) => (
                    <label
                      key={i}
                      className="flex items-center gap-2 rounded border p-2 cursor-pointer min-h-[44px]"
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={(answers[q.id] ?? '') === String(c?.key ?? c?.value ?? c)}
                        onChange={() => updateAnswer(q.id, String(c?.key ?? c?.value ?? c))}
                      />
                      <span>{String(c?.label ?? c?.value ?? c)}</span>
                    </label>
                  ))}
                </div>
              )}
              {qtype === 'numeric' && (
                <input
                  type="text"
                  inputMode="decimal"
                  className="mt-2 w-full rounded border px-3 py-2 min-h-[44px]"
                  placeholder="Enter number"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                />
              )}
              {qtype === 'short' && (
                <textarea
                  className="mt-2 w-full rounded border px-3 py-2"
                  placeholder="Write your answer"
                  rows={3}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                />
              )}
              {(qtype === 'long_answer' || qtype === 'long' || qtype === 'essay') && (
                <textarea
                  className="mt-2 w-full rounded border px-3 py-2"
                  placeholder="Write a detailed answer"
                  rows={6}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
