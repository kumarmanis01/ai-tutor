'use client';

/**
 * FILE OBJECTIVE:
 * - Admin debug page showing recent RecommendationTrace records.
 * - Filterable by studentId and entityType.
 *
 * EDIT LOG:
 * - 2026-03-03 | claude | created recommendation traces admin page
 */

import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Trace {
  id: string;
  studentId: string;
  entityType: string;
  entityId: string;
  score: number;
  signals: Record<string, unknown>;
  engineVersion: string;
  createdAt: string;
}

export default function RecommendationTracesPage() {
  const [studentId, setStudentId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [limit, setLimit] = useState(50);

  const params = new URLSearchParams();
  if (studentId.trim()) params.set('studentId', studentId.trim());
  if (entityType) params.set('entityType', entityType);
  params.set('limit', String(limit));

  const { data, error, isLoading } = useSWR<{ traces: Trace[]; count: number }>(
    `/api/admin/recommendations/traces?${params.toString()}`,
    fetcher,
    { refreshInterval: 10_000 },
  );

  const traces = data?.traces ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recommendation Traces</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Observability view of recommendation scoring decisions. Enable tracing with{' '}
          <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
            ENABLE_RECOMMENDATION_TRACE=true
          </code>
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Student ID
          </label>
          <input
            type="text"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            placeholder="Filter by student..."
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-64"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Entity Type
          </label>
          <select
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
            title="Filter by entity type"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All types</option>
            <option value="lesson">Lesson</option>
            <option value="practice">Practice</option>
            <option value="notes">Notes</option>
            <option value="test">Test</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Limit
          </label>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            title="Number of traces to show"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      {/* Status */}
      {isLoading && (
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading traces...</div>
      )}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">
          Failed to load traces: {error.message}
        </div>
      )}

      {/* Results */}
      {!isLoading && traces.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium">No traces found</p>
          <p className="text-sm mt-1">
            Ensure <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">ENABLE_RECOMMENDATION_TRACE=true</code> is set
            and the recommendation engine has been called.
          </p>
        </div>
      )}

      {traces.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Entity ID
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Signals
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Version
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {traces.map(trace => (
                <tr key={trace.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {new Date(trace.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-200">
                    {trace.studentId.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TypeBadge type={trace.entityType} />
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-300 max-w-[200px] truncate">
                    {trace.entityId}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    <ScoreBadge score={trace.score} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[300px]">
                    <SignalsSummary signals={trace.signals} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500 font-mono">
                    v{trace.engineVersion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-400 dark:text-gray-500">
        Showing {traces.length} trace{traces.length !== 1 ? 's' : ''} — auto-refreshes every 10s
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    lesson: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    practice: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    notes: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    test: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
      {type}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  let color = 'text-gray-600 dark:text-gray-400';
  if (score >= 80) color = 'text-green-600 dark:text-green-400 font-semibold';
  else if (score >= 50) color = 'text-blue-600 dark:text-blue-400';
  else if (score >= 30) color = 'text-yellow-600 dark:text-yellow-400';
  return <span className={color}>{score}</span>;
}

function SignalsSummary({ signals }: { signals: Record<string, unknown> }) {
  const reasoning = signals.reasoning;
  if (Array.isArray(reasoning)) {
    return <span>{reasoning.join(' · ')}</span>;
  }
  const keys = Object.keys(signals).filter(k => signals[k] != null && signals[k] !== false);
  return <span>{keys.join(', ')}</span>;
}
