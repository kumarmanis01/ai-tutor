"use client";

import React, { useEffect, useState } from 'react';
import { showAlert } from '@/lib/alerts';
import AttemptRunner from './AttemptRunner';

/**
 * WeeklyChallenge
 *
 * Shows the current weekly challenge card and lets the user start a mixed
 * difficulty practice attempt.
 */
export default function WeeklyChallenge() {
  const [meta, setMeta] = useState<{ title: string; description: string } | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    // In production, fetch active challenge from /api/challenge/current.
    setMeta({ title: 'Weekly Challenge', description: 'Advanced problems for extra practice' });
  }, []);

  async function start() {
    const res = await fetch('/api/tests/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'General', count: 12, difficulty: 'mixed' }),
    });
    const json = await res.json();
    if (!res.ok) {
      showAlert({ title: 'Error', message: json.error || 'Failed to start', variant: 'error' });
      return;
    }
    setAttemptId(json.attemptId);
    setQuestions(json.questions ?? []);
  }

  if (attemptId) return <AttemptRunner attemptId={attemptId} initialQuestions={questions} />;

  return (
    <div className="rounded-lg border p-4 bg-white shadow-sm">
      <h3 className="text-lg font-semibold">{meta?.title ?? 'Weekly Challenge'}</h3>
      <p className="text-sm text-gray-600">{meta?.description ?? ''}</p>
      <button className="mt-3 px-3 py-2 rounded bg-purple-600 text-white hover:bg-purple-700" onClick={start}>
        Start Now
      </button>
    </div>
  );
}
