'use client';

import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
  const [topicId, setTopicId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(50);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (studentId.trim()) params.set('studentId', studentId.trim());
  if (entityType) params.set('entityType', entityType);
  if (topicId.trim()) params.set('topicId', topicId.trim());
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  params.set('limit', String(limit));

  const { data, error, isLoading } = useSWR<{ traces: Trace[]; count: number }>(
    `/api/admin/recommendations/traces?${params.toString()}`,
    fetcher
  );

  const traces = data?.traces ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recommendation Traces</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Debug recommendation scoring decisions. Enable with{' '}
          <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
            ENABLE_RECOMMENDATION_TRACE=true
          </code>
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <FilterInput
          label="Student ID"
          value={studentId}
          onChange={setStudentId}
          placeholder="cuid..."
        />
        <FilterInput label="Topic ID" value={topicId} onChange={setTopicId} placeholder="cuid..." />
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Entity Type
          </label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            title="Filter by entity type"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Filter traces from this date"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Filter traces up to this date"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Limit
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            title="Number of traces to show"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      {/* Clear filters */}
      {(studentId || topicId || entityType || dateFrom || dateTo) && (
        <button
          type="button"
          onClick={() => {
            setStudentId('');
            setTopicId('');
            setEntityType('');
            setDateFrom('');
            setDateTo('');
          }}
          className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
        >
          Clear all filters
        </button>
      )}

      {/* Status */}
      {isLoading && (
        <div className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          Loading traces...
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">
          Failed to load traces: {error.message}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && traces.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium">No traces found</p>
          <p className="text-sm mt-1">
            Ensure{' '}
            <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
              ENABLE_RECOMMENDATION_TRACE=true
            </code>{' '}
            is set and the recommendation engine has been called.
          </p>
        </div>
      )}

      {/* Table */}
      {traces.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Timestamp', 'Student', 'Type', 'Entity ID', 'Score', 'Signals', 'Version'].map(
                  (h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                        h === 'Score' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {traces.map((trace) => (
                <React.Fragment key={trace.id}>
                  <tr
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === trace.id ? null : trace.id)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {formatTimestamp(trace.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-200">
                      {trace.studentId.slice(0, 8)}&hellip;
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

                  {/* Expanded detail row */}
                  {expandedRow === trace.id && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 bg-gray-50 dark:bg-gray-800">
                        <SignalsDetail
                          signals={trace.signals}
                          entityId={trace.entityId}
                          studentId={trace.studentId}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-400 dark:text-gray-500">
        Showing {traces.length} trace{traces.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      />
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
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
    >
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
    return <span>{reasoning.join(' \u00B7 ')}</span>;
  }
  const keys = Object.keys(signals).filter((k) => {
    const v = signals[k];
    return v != null && v !== false && v !== 0;
  });
  if (keys.length === 0) return <span className="italic text-gray-400">none</span>;
  return <span>{keys.join(', ')}</span>;
}

function SignalsDetail({
  signals,
  entityId,
  studentId,
}: {
  signals: Record<string, unknown>;
  entityId: string;
  studentId: string;
}) {
  const entries = Object.entries(signals).filter(([, v]) => v != null);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Full Student ID: </span>
          <span className="font-mono text-gray-700 dark:text-gray-200">{studentId}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Full Entity ID: </span>
          <span className="font-mono text-gray-700 dark:text-gray-200">{entityId}</span>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase mb-1">
          Signal Breakdown
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between bg-white dark:bg-gray-900 rounded px-3 py-1.5 border border-gray-100 dark:border-gray-700"
            >
              <span className="text-xs text-gray-600 dark:text-gray-400">{key}</span>
              <span className="text-xs font-mono font-medium text-gray-800 dark:text-gray-200">
                {typeof value === 'number'
                  ? value
                  : typeof value === 'boolean'
                    ? value
                      ? 'true'
                      : 'false'
                    : JSON.stringify(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
}
