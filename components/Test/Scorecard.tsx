"use client";

import React from 'react';

/**
 * Scorecard
 *
 * Displays summary of grading results returned by `/api/tests/submit`.
 */
export default function Scorecard(props: { result: any }) {
  const r = props.result ?? {};
  return (
    <div className="mt-4 rounded-lg border p-4 bg-white shadow-sm">
      <h3 className="text-lg font-semibold">Scorecard</h3>
      <p className="mt-1 text-gray-700">Score: {Math.round(r.scorePercent ?? 0)}%</p>
      <p className="text-sm text-gray-600">Points: {r.earnedPoints ?? 0} / {r.totalPoints ?? 0}</p>

      <div className="mt-3">
        <h4 className="font-medium">Question Breakdown</h4>
        <ul className="mt-2 space-y-2">
          {(r.graded ?? []).map((g: any, i: number) => (
            <li key={g.attemptQuestionId} className="rounded border p-2 flex items-center justify-between">
              <span className="text-sm">Q{i + 1}</span>
              <span className={g.correct ? 'text-green-600' : 'text-red-600'}>
                {g.correct ? 'Correct' : g.partial ? 'Partial' : 'Wrong'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
