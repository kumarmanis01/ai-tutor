"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface TopicData {
  topicId: string;
  topicTitle: string;
  subject: string;
  chapter: string;
  reason: string;
}

export default function TutorRecommendationCard() {
  const router = useRouter();
  const [topic, setTopic] = useState<TopicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/next-topic")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setTopic(data?.topic ?? null);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartLesson = useCallback(async () => {
    if (!topic || starting) return;
    setStarting(true);
    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: topic.topicId }),
      });
      if (!res.ok) throw new Error("Failed to start session");
      const data = await res.json();
      const sessionId = data?.session?.sessionId;
      if (sessionId) {
        router.push(`/session/${sessionId}`);
      } else {
        setStarting(false);
      }
    } catch {
      setStarting(false);
    }
  }, [topic, starting, router]);

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <article className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm animate-pulse">
        <div className="h-3 w-20 bg-gray-200 rounded mb-4" />
        <div className="h-5 w-44 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-32 bg-gray-100 rounded mb-5" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </article>
    );
  }

  // ── No recommendation available ─────────────────────────────────────────
  if (!topic || error) {
    return (
      <article className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-300 animate-pulse" aria-hidden />
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Today&apos;s Lesson
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Preparing your learning plan&hellip;
        </p>
      </article>
    );
  }

  // ── Recommendation card ─────────────────────────────────────────────────
  return (
    <article className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Today&apos;s Lesson
        </span>
      </div>

      <p className="text-sm text-gray-500 mt-2">{topic.subject}</p>

      <h3 className="text-xl font-bold text-gray-900 mt-1">
        {topic.topicTitle}
      </h3>

      <p className="text-xs text-gray-400 mt-1">
        Chapter: {topic.chapter}
      </p>

      {topic.reason && (
        <p className="text-xs text-indigo-400 mt-1 italic">{topic.reason}</p>
      )}

      <div className="mt-5">
        <button
          type="button"
          onClick={handleStartLesson}
          disabled={starting}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {starting ? (
            <>
              <Spinner />
              Starting&hellip;
            </>
          ) : (
            <>
              <PlayIcon />
              Start Lesson
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
      <path d="M22 12a10 10 0 00-10-10" stroke="white" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
