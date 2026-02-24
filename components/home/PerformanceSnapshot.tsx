/**
 * FILE OBJECTIVE:
 * - Renders the last 5 practice results with topic, accuracy, and date.
 * - Shows average accuracy and weakest topic indicator.
 * - Pure presentational — data is fetched server-side.
 * - No charts. No redesign. Clean deterministic data.
 *
 * EDIT LOG:
 * - 2026-02-22 | claude | created
 */

import React from 'react';

export type PracticeResult = {
  topicName: string;
  accuracy: number; // 0-1
  date: string;     // YYYY-MM-DD
};

export interface PerformanceSnapshotProps {
  recentResults: PracticeResult[];
  averageAccuracy: number; // 0-1
  weakestTopic: string | null;
}

function accuracyLabel(accuracy: number): string {
  if (accuracy >= 0.85) return 'Excellent';
  if (accuracy >= 0.7) return 'Good';
  if (accuracy >= 0.5) return 'Needs work';
  return 'Weak';
}

function accuracyColor(accuracy: number): string {
  if (accuracy >= 0.75) return 'text-emerald-600';
  if (accuracy >= 0.5) return 'text-blue-600';
  return 'text-red-500';
}

export default function PerformanceSnapshot({
  recentResults,
  averageAccuracy,
  weakestTopic,
}: PerformanceSnapshotProps) {
  const results = Array.isArray(recentResults) ? recentResults : [];
  const avgPct = Math.round((averageAccuracy ?? 0) * 100);

  return (
    <section
      className="max-w-4xl mx-auto bg-white rounded-lg border p-6 mb-8"
      aria-labelledby="perf-snapshot-heading"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 id="perf-snapshot-heading" className="text-lg font-semibold">
          Practice Performance
        </h3>
        {results.length > 0 && (
          <span className="text-sm text-gray-500">
            Avg&nbsp;
            <span className={`font-semibold ${accuracyColor(averageAccuracy)}`}>
              {avgPct}%
            </span>
          </span>
        )}
      </div>

      {results.length === 0 ? (
        <p className="text-sm text-gray-500">No practice results yet. Complete a practice session to see your performance.</p>
      ) : (
        <>
          {/* Results table */}
          <table className="w-full text-sm" aria-label="Recent practice results">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 font-medium">Topic</th>
                <th className="pb-2 font-medium text-right">Accuracy</th>
                <th className="pb-2 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.map((r, i) => (
                <tr
                  key={i}
                  className={r.topicName === weakestTopic ? 'bg-red-50' : ''}
                >
                  <td className="py-2 text-gray-800 truncate max-w-[200px]">
                    {r.topicName === weakestTopic && (
                      <span
                        className="inline-block mr-1 text-red-500 text-xs font-medium"
                        aria-label="Weakest topic"
                        title="Weakest topic"
                      >
                        ↓
                      </span>
                    )}
                    {r.topicName}
                  </td>
                  <td className={`py-2 text-right font-medium ${accuracyColor(r.accuracy)}`}>
                    {Math.round(r.accuracy * 100)}%
                  </td>
                  <td className="py-2 text-right text-gray-400 text-xs">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Weakest topic callout */}
          {weakestTopic && (
            <div className="mt-4 flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded p-3">
              <span aria-hidden>⚠</span>
              <span>
                <span className="font-medium">Weakest topic:</span> {weakestTopic} — consider
                revisiting this before your next session.
              </span>
            </div>
          )}

          {/* Summary row */}
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-gray-500">
            <span>Last {results.length} practice session{results.length !== 1 ? 's' : ''}</span>
            <span>
              Average: <span className={`font-medium ${accuracyColor(averageAccuracy)}`}>{avgPct}% — {accuracyLabel(averageAccuracy)}</span>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
