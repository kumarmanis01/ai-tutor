"use client";

import React, { useEffect, useState } from 'react';
import { showAlert } from '@/lib/alerts';
import AttemptRunner from './AttemptRunner';

/**
 * ChapterTests
 *
 * Displays chapter cards for a subject and lets user start a fixed-length test
 * per chapter. Questions are selected via filters when starting.
 */
export default function ChapterTests(props: { subject?: string; grade?: string; board?: string }) {
  const [chapters, setChapters] = useState<string[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    // In production, fetch available chapters from backend.
    // For now, derive from curated samples.
    const defaults = ['Basic Algebra', 'Fractions', 'Geometry'];
    setChapters(defaults);
  }, []);

  async function startChapter(chapter: string) {
    const res = await fetch('/api/tests/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: props.subject ?? 'Math', grade: props.grade, board: props.board, chapter, count: 10 }),
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
      <h3 className="text-lg font-semibold">Chapter Tests</h3>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {chapters.map((c) => (
          <div key={c} className="rounded border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium">{c}</p>
              <p className="text-xs text-gray-600">10 Questions • 8 mins</p>
            </div>
            <button
              className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => startChapter(c)}
            >
              Start
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
