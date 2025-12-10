"use client";

import React, { useState } from 'react';
import AttemptRunner from './AttemptRunner';

/**
 * QuickPractice
 *
 * Modular launcher for time-boxed practice sets. It starts a new attempt via
 * `POST /api/tests/start` and then renders `AttemptRunner` to take the test.
 *
 * Props allow the dashboard or landing to control scope without tight coupling.
 */
export default function QuickPractice(props: {
  subject?: string;
  grade?: string;
  board?: string;
  questionCount?: number;
}) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tests/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: props.subject,
          grade: props.grade,
          board: props.board,
          count: props.questionCount ?? 10,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to start');
      setAttemptId(json.attemptId);
      setQuestions(json.questions ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (attemptId) {
    return <AttemptRunner attemptId={attemptId} initialQuestions={questions} />;
  }

  return (
    <div className="rounded-lg border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Quick Practice</h3>
          <p className="text-sm text-gray-600">{props.subject || 'General'} • {props.grade || 'Any'} • {props.board || 'Any'}</p>
        </div>
        <button
          className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={start}
          disabled={loading}
        >
          {loading ? 'Starting…' : 'Start Now'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
