/**
 * FILE OBJECTIVE:
 * - S2.2 lesson experience for topic learning with key points, rich content, hint card, and completion CTA.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/learning-map/LessonExperience.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.2 lesson experience component
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type LessonPayload = {
  topicId: string;
  chapterId: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  title: string;
  introduction: string;
  keyPoints: string[];
  sections: Array<{ heading: string; body: string }>;
  studyBuddyHint: string;
  video: string | null;
};

type LessonExperienceProps = {
  studentId: string;
  topicId: string;
};

export default function LessonExperience({ studentId, topicId }: LessonExperienceProps) {
  const [lesson, setLesson] = useState<LessonPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/content/${encodeURIComponent(topicId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Failed to load lesson (${res.status})`);
        const payload = (await res.json()) as LessonPayload;
        if (active) {
          setLesson(payload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load lesson');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [topicId]);

  async function markComplete() {
    if (isCompleting || isCompleted) return;
    setIsCompleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/students/${encodeURIComponent(studentId)}/progress/topic/${encodeURIComponent(topicId)}/complete`,
        {
          method: 'POST',
        }
      );
      if (!res.ok) throw new Error('Failed to mark topic complete');
      setIsCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark complete');
    } finally {
      setIsCompleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-gray-100" />
        <div className="mt-4 h-44 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-xl border border-[#E24B4A] bg-[#FCEBEB] px-4 py-3 text-sm text-[#E24B4A]">
          {error ?? 'Lesson unavailable right now.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 animate-[fadeIn_220ms_ease-out]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href="/student/learning-map" className="text-sm font-semibold text-[#534AB7] hover:underline">
          ← Back to Map
        </Link>
        <button
          type="button"
          className="min-h-[44px] rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          onClick={() => {
            // Reuse existing support flow for content issues.
            window.location.href = '/doubts';
          }}
        >
          Report Content Issue
        </button>
      </div>

      <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {lesson.subjectName} · {lesson.chapterName}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{lesson.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-700">{lesson.introduction}</p>

        {lesson.keyPoints.length > 0 && (
          <section className="mt-4 rounded-xl border border-[#534AB7]/20 bg-[#EEEDFE] p-4">
            <p className="text-sm font-semibold text-[#534AB7]">Key Points</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#3C3489]">
              {lesson.keyPoints.map((point, index) => (
                <li key={`${point}-${index}`}>{point}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-5 space-y-4">
          {lesson.sections.map((section, index) => (
            <div key={`${section.heading}-${index}`} className="rounded-xl border border-gray-200 p-4">
              <h2 className="text-base font-semibold text-gray-900">{section.heading}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{section.body}</p>
            </div>
          ))}
        </section>

        {lesson.video && (
          <section className="mt-5 rounded-xl border border-gray-200 p-4">
            <button
              type="button"
              onClick={() => setShowVideo((prev) => !prev)}
              className="min-h-[44px] text-sm font-semibold text-[#534AB7] hover:underline"
            >
              {showVideo ? 'Hide Video Snippet' : 'Show Video Snippet'}
            </button>
            {showVideo && (
              <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                <iframe
                  src={lesson.video}
                  title="Lesson Video"
                  className="h-64 w-full"
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            )}
          </section>
        )}

        <aside className="mt-5 rounded-xl border border-[#1D9E75]/20 bg-[#EAF3DE] p-4">
          <p className="text-sm font-semibold text-[#1D9E75]">Study Buddy Hint</p>
          <p className="mt-1 text-sm text-[#1D9E75]">{lesson.studyBuddyHint}</p>
        </aside>

        {error && (
          <p className="mt-4 rounded-lg border border-[#E24B4A] bg-[#FCEBEB] px-3 py-2 text-sm text-[#E24B4A]">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              void markComplete();
            }}
            disabled={isCompleting || isCompleted}
            className="min-h-[44px] rounded-xl bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {isCompleted ? 'Completed ✓' : isCompleting ? 'Marking...' : 'Mark as Complete'}
          </button>
          <Link
            href={`/student/learning-map/topic/${encodeURIComponent(topicId)}/practice`}
            className="min-h-[44px] rounded-xl border border-[#534AB7] px-4 py-2 text-center text-sm font-semibold text-[#534AB7] hover:bg-[#EEEDFE]"
          >
            Practice This Topic
          </Link>
        </div>
      </article>
    </div>
  );
}
