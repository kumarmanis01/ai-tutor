/**
 * FILE OBJECTIVE:
 * - Hero card shown at the top of the student dashboard.
 * - Fetches the next recommended topic via useNextTopic.
 * - Start button navigates to /session/{topicId}; SessionContainer handles start internally.
 * - Renders nothing when no recommendation is available.
 *
 * EDIT LOG:
 * - 2026-03-06 | Manish Kumar | created tutor-guided hero card
 */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useNextTopic } from "@/hooks/useNextTopic";

const STEPS = ["Explanation", "Practice", "Test"] as const;
const DEFAULT_MINUTES = 20;

export default function TodaysLessonCard() {
  const router = useRouter();
  const { topic, loading } = useNextTopic();
  const [starting, setStarting] = useState(false);

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-violet-100 bg-white p-6">
        <div className="h-4 w-28 rounded bg-violet-100" />
        <div className="mt-3 h-7 w-64 rounded bg-gray-200" />
        <div className="mt-2 h-4 w-40 rounded bg-gray-100" />
      </div>
    );
  }

  if (!topic) return null;

  const minutes = topic.estimatedMinutes ?? DEFAULT_MINUTES;

  function handleStart() {
    if (!topic) return;
    setStarting(true);
    // SessionContainer calls POST /api/session/start internally (idempotent).
    // Navigate directly — no pre-flight needed.
    router.push(`/session/${topic.topicId}`);
  }

  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-lg"
      aria-label="Today's lesson"
    >
      {/* Background decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-6 right-16 h-24 w-24 rounded-full bg-white/5"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Content */}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-200">
            Today&apos;s Lesson
          </p>

          {/* Subject & Chapter breadcrumb */}
          <p className="mt-1 text-sm text-violet-300">
            {topic.subject}
            {topic.chapter ? <> &rsaquo; {topic.chapter}</> : null}
          </p>

          {/* Topic title */}
          <h2 className="mt-1 text-2xl font-bold leading-tight text-white">
            {topic.topicTitle}
          </h2>

          {/* Session steps */}
          <ol className="mt-3 flex flex-wrap gap-2">
            {STEPS.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {/* Estimated time */}
          <p className="mt-3 flex items-center gap-1.5 text-sm text-violet-200">
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
            </svg>
            {minutes} minutes
          </p>
        </div>

        {/* CTA */}
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-violet-600 disabled:opacity-60"
          >
            {starting ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                  />
                </svg>
                Starting…
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
                Start Lesson
              </>
            )}
          </button>

        </div>
      </div>
    </article>
  );
}
