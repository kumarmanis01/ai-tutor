"use client";

import React, { useMemo, useState } from 'react';
import { showAlert } from '@/lib/alerts';
import Scorecard from './Scorecard';

/**
 * AttemptRunner
 *
 * Renders a list of questions and collects answers. Submits to
 * `POST /api/tests/submit` and displays `Scorecard` on completion.
 */
export default function AttemptRunner(props: { attemptId: string; initialQuestions: any[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<any | null>(null);

  const questions = useMemo(() => props.initialQuestions ?? [], [props.initialQuestions]);

  function updateAnswer(qid: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const payload = {
        attemptId: props.attemptId,
        answers: questions.map((q: any) => ({ questionId: q.id, answer: answers[q.id] ?? '' })),
      };
      const res = await fetch('/api/tests/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit');
      setScore(json);
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message ?? 'Failed to submit', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  if (score) return <Scorecard result={score} />;

  return (
    <div className="mt-4 rounded-lg border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Practice Attempt</h3>
        <button
          className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? 'Submitting…' : 'Submit Answers'}
        </button>
      </div>
      <ol className="mt-3 space-y-4">
        {questions.map((q: any, idx: number) => (
          <li key={q.id} className="rounded border p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-gray-500">Q{idx + 1}</span>
              <p className="text-gray-900">{q.prompt}</p>
            </div>
            {q.type.toLowerCase() === 'mcq' && Array.isArray(q.choices) && (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {q.choices.map((c: any, i: number) => (
                  <label key={i} className="flex items-center gap-2 rounded border p-2 cursor-pointer">
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
            {q.type.toLowerCase() === 'numeric' && (
              <input
                type="text"
                inputMode="decimal"
                className="mt-2 w-full rounded border px-3 py-2"
                placeholder="Enter number"
                value={answers[q.id] ?? ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
              />
            )}
            {q.type.toLowerCase() === 'short' && (
              <textarea
                className="mt-2 w-full rounded border px-3 py-2"
                placeholder="Write your answer"
                rows={4}
                value={answers[q.id] ?? ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
