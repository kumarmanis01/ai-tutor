'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { showAlert } from '../../lib/alerts';
import AttemptRunner from './AttemptRunner';
import ChapterTrend from './ChapterTrend';
import ContentModal from '../UI/ContentModal';
import MiniSparkline from '../student/progress/MiniSparkline';
import Link from 'next/link';

/**
 * ChapterTests
 *
 * Displays chapter cards for a subject and lets user start a fixed-length test
 * per chapter. Chapters come from the academic hierarchy via props.
 */
export default function ChapterTests(props: {
  subject?: string;
  grade?: string;
  board?: string;
  chapters?: Array<{ id: string; name: string }>;
}) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | undefined>(undefined);
  const [modalChapter, setModalChapter] = useState<{ id: string; name: string } | null>(null);

  const chapters = useMemo(() => props.chapters ?? [], [props.chapters]);
  const [sparklineMap, setSparklineMap] = useState<
    Record<string, Array<{ date: string; score: number }>>
  >({});

  useEffect(() => {
    let mounted = true;
    async function fetchSparklines() {
      if (chapters.length === 0) return;
      try {
        const params = new URLSearchParams();
        if (props.subject) params.set('subject', props.subject);
        chapters.forEach((c) => params.append('chapter', c.name));
        const res = await fetch(`/api/student/tests/trends?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load sparklines');
        if (!mounted) return;
        setSparklineMap(json?.data ?? {});
      } catch {
        // ignore sparklines failure -- sparklines are non-critical
      }
    }

    fetchSparklines();
    return () => {
      mounted = false;
    };
  }, [chapters, props.subject]);

  async function startChapter(chapter: string) {
    const res = await fetch('/api/tests/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: props.subject,
        grade: props.grade,
        board: props.board,
        chapter,
        count: 10,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      showAlert({ title: 'Error', message: json.error || 'Failed to start', variant: 'error' });
      return;
    }
    setAttemptId(json.attemptId);
    setQuestions(json.questions ?? []);
    setTimeLimitSeconds(json.timeLimitSeconds ?? undefined);
  }

  if (attemptId)
    return (
      <AttemptRunner
        attemptId={attemptId}
        initialQuestions={questions}
        timeLimitSeconds={timeLimitSeconds}
      />
    );

  if (chapters.length === 0) return null;

  return (
    <div className="rounded-lg border p-4 bg-white shadow-sm">
      <h3 className="text-lg font-semibold">Chapter Tests</h3>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {chapters.map((c) => (
          <div key={c.id} className="rounded border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium">{c.name}</p>
                <div className="mt-2 flex items-center gap-3">
                  <p className="text-xs text-gray-600">10 Questions</p>
                  <div>
                    <MiniSparkline
                      chapter={c.name}
                      subject={props.subject}
                      trendData={sparklineMap[c.name]}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => startChapter(c.name)}
                >
                  Start
                </button>
                <button
                  className="px-3 py-2 rounded border text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setModalChapter({ id: c.id, name: c.name })}
                >
                  Trend
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modalChapter && (
        <ContentModal
          open={!!modalChapter}
          title={modalChapter ? `Practice trend -- ${modalChapter.name}` : 'Practice trend'}
          onClose={() => setModalChapter(null)}
          footer={
            <div className="flex justify-end">
              <Link
                href={`/student/tests/history?chapter=${encodeURIComponent(modalChapter.name)}`}
                className="text-sm font-medium text-indigo-600"
              >
                View history
              </Link>
            </div>
          }
        >
          <div className="py-2">
            <ChapterTrend chapter={modalChapter.name} subject={props.subject} showSkeleton />
          </div>
        </ContentModal>
      )}
    </div>
  );
}
