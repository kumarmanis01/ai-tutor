/**
 * FILE OBJECTIVE:
 * - Self-fetching weekly progress card for the student dashboard.
 * - Calls GET /api/student/progress and renders a goal progress bar
 *   plus three metric chips (Topics Completed, Sessions, Subjects).
 *
 * EDIT LOG:
 * - 2026-03-06 | Manish Kumar | created for tutor-guided dashboard
 */
"use client";

import React, { useEffect, useState } from "react";

interface ProgressData {
  topicsCompleted: number;
  sessionsCompleted: number;
  subjectsExplored: number;
  weeklyGoalMinutes: number;
  minutesStudied: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function WeeklyProgress() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/progress")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
        <div className="h-4 w-36 rounded bg-gray-200" />
        <div className="h-3 w-full rounded-full bg-gray-100" />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 flex-1 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { topicsCompleted, sessionsCompleted, subjectsExplored, weeklyGoalMinutes, minutesStudied } = data;

  const pct = weeklyGoalMinutes > 0
    ? clamp(Math.round((minutesStudied / weeklyGoalMinutes) * 100), 0, 100)
    : 0;

  const metrics = [
    { label: "Topics Completed", value: topicsCompleted, icon: "📖" },
    { label: "Sessions", value: sessionsCompleted, icon: "✅" },
    { label: "Subjects", value: subjectsExplored, icon: "🔭" },
  ];

  return (
    <article
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
      aria-label="Weekly progress"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Weekly Goal</h3>
        <span className="text-xs font-medium text-gray-400">
          {minutesStudied} / {weeklyGoalMinutes} min
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={minutesStudied}
        aria-valuemin={0}
        aria-valuemax={weeklyGoalMinutes}
        aria-label={`${minutesStudied} of ${weeklyGoalMinutes} minutes studied`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-right text-xs text-gray-400">{pct}% complete</p>

      {/* Metric chips */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {metrics.map(({ label, value, icon }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center gap-1 rounded-xl bg-gray-50 py-3 px-2 text-center"
          >
            <span className="text-xl" aria-hidden="true">{icon}</span>
            <span className="text-2xl font-bold text-gray-800 tabular-nums">
              {value}
            </span>
            <span className="text-[11px] leading-tight text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
