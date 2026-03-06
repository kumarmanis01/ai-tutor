"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface TopicData {
  topicId: string;
  subject: string;
  chapter: string;
  reason: string;
}

export default function TutorRecommendationCard() {
  const router = useRouter();
  const [topic, setTopic] = useState<TopicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/next-topic")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTopic(data?.topic ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartSession = useCallback(async () => {
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
      }
    } catch {
      setStarting(false);
    }
  }, [topic, starting, router]);

  if (loading) {
    return (
      <article className="bg-white rounded-lg border p-6 animate-pulse">
        <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
        <div className="h-6 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-36 bg-gray-200 rounded" />
      </article>
    );
  }

  if (!topic) return null;

  return (
    <article className="bg-white rounded-lg border p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">
          Today&apos;s Lesson
        </span>
      </div>

      <h3 className="text-xl font-semibold mt-2">{topic.chapter}</h3>

      <p className="text-sm text-gray-500 mt-1">{topic.subject}</p>

      <p className="text-xs text-gray-400 mt-1 italic">{topic.reason}</p>

      <div className="mt-5">
        <button
          type="button"
          onClick={handleStartSession}
          disabled={starting}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {starting ? (
            <>
              <Spinner />
              Starting…
            </>
          ) : (
            <>
              <PlayIcon />
              Start Learning
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
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
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
      <path d="M22 12a10 10 0 00-10-10" stroke="white" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
