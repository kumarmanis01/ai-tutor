/**
 * FILE OBJECTIVE:
 * - Celebration modal shown when a session reaches the COMPLETE state.
 * - Displays topic name, a "Mastery Updated" badge, and two CTAs:
 *     Continue Learning → /dashboard
 *     Review Notes      → /dashboard/notes?topicId={topicId}
 * - CSS-only confetti animation; no external libraries required.
 *
 * EDIT LOG:
 * - 2026-03-06 | Manish Kumar | created topic completion celebration modal
 */
"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Confetti particles ───────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
];

const PARTICLE_COUNT = 30;

function ConfettiParticle({ index }: { index: number }) {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const left = `${5 + ((index * 97) % 90)}%`;
  const delay = `${(index * 0.11) % 1.2}s`;
  const duration = `${1.4 + (index % 5) * 0.2}s`;
  const size = index % 3 === 0 ? "8px" : "6px";
  const rotate = `${(index * 47) % 360}deg`;

  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "-10px",
        left,
        width: size,
        height: size,
        borderRadius: index % 2 === 0 ? "50%" : "2px",
        backgroundColor: color,
        animation: `confettiFall ${duration} ${delay} ease-in forwards`,
        transform: `rotate(${rotate})`,
      }}
    />
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export interface TopicCompletionModalProps {
  topicName: string;
  topicId: string;
  /** Called when the user dismisses without navigating */
  onClose?: () => void;
}

export default function TopicCompletionModal({
  topicName,
  topicId,
  onClose,
}: TopicCompletionModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Trap focus inside modal and handle Escape
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      prev?.focus();
    };
  }, [onClose]);

  function handleContinue() {
    router.push("/dashboard");
  }

  function handleReviewNotes() {
    router.push(`/dashboard/notes?topicId=${encodeURIComponent(topicId)}`);
  }

  return (
    <>
      {/* Keyframe injection */}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(320px) rotate(720deg); opacity: 0; }
        }
        @keyframes modalPop {
          0%   { transform: scale(0.88) translateY(12px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes badgePulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.06); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
        role="presentation"
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      >
        {/* Dialog */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="completion-title"
          tabIndex={-1}
          className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl focus:outline-none"
          style={{ animation: "modalPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
        >
          {/* Confetti layer */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden"
          >
            {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
              <ConfettiParticle key={i} index={i} />
            ))}
          </div>

          {/* Header gradient band */}
          <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-6 pt-10 pb-8 text-center">
            {/* Trophy icon */}
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-4xl shadow-inner">
              🎉
            </div>

            <h2
              id="completion-title"
              className="text-xl font-bold text-white"
            >
              Topic Completed!
            </h2>

            <p className="mt-1 text-sm font-medium text-violet-200 truncate px-2">
              {topicName}
            </p>

            {/* Mastery Updated badge */}
            <div
              className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-1.5"
              style={{ animation: "badgePulse 1.8s ease-in-out 0.4s infinite" }}
            >
              <svg
                className="h-3.5 w-3.5 text-emerald-300"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs font-semibold text-white">
                Mastery Updated
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 px-6 py-6">
            <button
              type="button"
              onClick={handleContinue}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
            >
              Continue Learning
            </button>

            <button
              type="button"
              onClick={handleReviewNotes}
              className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 transition"
            >
              Review Notes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
