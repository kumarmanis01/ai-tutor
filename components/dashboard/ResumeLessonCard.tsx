/**
 * FILE OBJECTIVE:
 * - Dashboard card that lets students continue an in-progress session.
 * - Self-fetching via useResumeSession hook; renders nothing when no session is active.
 *
 * EDIT LOG:
 * - 2026-03-06 | claude | created for resume lesson feature
 */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useResumeSession } from "@/hooks/useResumeSession";

const PHASE_LABELS: Record<string, string> = {
  EXPLANATION: "Explanation",
  PRACTICE: "Practice",
  TEST: "Test",
  HOMEWORK: "Homework",
};

export default function ResumeLessonCard() {
  const router = useRouter();
  const { session, loading } = useResumeSession();

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-gray-100 bg-white p-5">
        <div className="h-5 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-56 bg-gray-100 rounded mt-3" />
      </div>
    );
  }

  if (!session) return null;

  const phaseLabel = PHASE_LABELS[session.phase] ?? session.phase;

  return (
    <article
      className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-5 shadow-sm"
      aria-label="Resume your lesson"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Resume Your Lesson
          </p>
          <h3 className="mt-1 text-lg font-bold text-gray-900 truncate">
            Topic: {session.topicName}
          </h3>
          <p className="mt-0.5 text-sm text-gray-500">
            {session.subject} &middot; {session.chapter}
          </p>
          <p className="mt-1 text-xs text-indigo-500 font-medium">
            Phase: {phaseLabel}
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push(`/session/${session.sessionId}`)}
          className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
              clipRule="evenodd"
            />
          </svg>
          Continue
        </button>
      </div>
    </article>
  );
}
