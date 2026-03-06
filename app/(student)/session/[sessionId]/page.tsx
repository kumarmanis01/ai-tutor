"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface SessionData {
  sessionId: string;
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
  state: string;
  startedAt: string;
  completedAt: string | null;
}

interface PhaseData {
  phase: string;
  label: string;
  instruction: string;
}

interface HomeworkData {
  id: string;
  status: string;
  score: number | null;
  dueDate: string;
}

const PHASES = ["EXPLANATION", "PRACTICE", "TEST", "HOMEWORK", "COMPLETE"];

const PHASE_ICONS: Record<string, string> = {
  EXPLANATION: "📖",
  PRACTICE: "✏️",
  TEST: "📝",
  HOMEWORK: "📋",
  COMPLETE: "✅",
};

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [phase, setPhase] = useState<PhaseData | null>(null);
  const [homework, setHomework] = useState<HomeworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}`);
      if (!res.ok) throw new Error("Failed to load session");
      const data = await res.json();
      setSession(data.session);
      setPhase(data.phase);
      setHomework(data.homework);
    } catch {
      setError("Could not load session.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleNext = useCallback(async () => {
    if (advancing || !session) return;
    setAdvancing(true);
    try {
      const res = await fetch("/api/session/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      if (!res.ok) throw new Error("Failed to advance");
      const data = await res.json();
      setSession(data.session);
      setPhase(data.phase);
      if (data.session?.state === "HOMEWORK") {
        await fetchSession();
      }
    } catch {
      setError("Failed to advance session.");
    } finally {
      setAdvancing(false);
    }
  }, [advancing, session, fetchSession]);

  const handleComplete = useCallback(async () => {
    if (advancing || !session) return;
    setAdvancing(true);
    try {
      const res = await fetch("/api/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      if (!res.ok) throw new Error("Failed to complete");
      const data = await res.json();
      setSession(data.session);
      setPhase(data.phase);
    } catch {
      setError("Failed to complete session.");
    } finally {
      setAdvancing(false);
    }
  }, [advancing, session]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !session || !phase) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">{error || "Session not found."}</p>
        <Link href="/dashboard" className="text-indigo-600 hover:underline mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const currentIdx = PHASES.indexOf(session.state);
  const isComplete = session.state === "COMPLETE";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-500">{session.subject} &middot; {session.chapter}</p>
        <h1 className="text-2xl font-bold mt-1">{session.topicName}</h1>
      </div>

      {/* Phase Progress Bar */}
      <div className="flex items-center gap-1 mb-8">
        {PHASES.slice(0, -1).map((p, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={p} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full h-2 rounded-full transition-colors ${
                  done
                    ? "bg-indigo-600"
                    : active
                    ? "bg-indigo-400"
                    : "bg-gray-200"
                }`}
              />
              <span
                className={`text-xs ${
                  done || active ? "text-indigo-600 font-medium" : "text-gray-400"
                }`}
              >
                {PHASE_ICONS[p]} {p.charAt(0) + p.slice(1).toLowerCase()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Phase Content Card */}
      <div className="bg-white rounded-lg border p-8 mb-6">
        {isComplete ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900">Topic Complete!</h2>
            <p className="text-gray-500 mt-2">{phase.instruction}</p>
            <Link
              href="/dashboard"
              className="inline-block mt-6 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{PHASE_ICONS[session.state]}</span>
              <div>
                <h2 className="text-xl font-semibold">{phase.label}</h2>
                <p className="text-sm text-gray-500">
                  Step {currentIdx + 1} of {PHASES.length - 1}
                </p>
              </div>
            </div>

            <p className="text-gray-600 mb-6">{phase.instruction}</p>

            {/* Homework-specific UI */}
            {session.state === "HOMEWORK" && homework && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-amber-800">
                  Homework assigned &middot; Due{" "}
                  {new Date(homework.dueDate).toLocaleDateString()}
                </p>
                {homework.status === "GRADED" ? (
                  <p className="text-sm text-amber-700 mt-1">
                    Score: {Math.round((homework.score ?? 0) * 100)}%
                  </p>
                ) : (
                  <p className="text-sm text-amber-700 mt-1">
                    Status: {homework.status}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleNext}
                disabled={advancing}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {advancing ? "Loading…" : currentIdx === PHASES.length - 2 ? "Finish" : "Next Step"}
                {!advancing && (
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>

              {currentIdx < PHASES.length - 2 && (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={advancing}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 focus:outline-none"
                >
                  Skip to finish
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
