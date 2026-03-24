'use client';

import React, { useMemo, useState } from 'react';
import { useAdminSafetyEvents, type AdminSafetyEvent } from '@/hooks/useAdminSafetyEvents';
import { patchSafetyEventResolved } from '@/hooks/usePatchSafetyEventResolved';

function truncateMiddle(id: string, n = 8) {
  const s = String(id || '');
  if (s.length <= n) return s;
  return `${s.slice(0, n)}...`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function categoryStyle(category: string) {
  const c = String(category || '').toUpperCase();
  if (c === 'JAILBREAK') return 'bg-red-100 text-red-800';
  if (c === 'PII') return 'bg-amber-100 text-amber-800';
  if (c === 'UNSAFE_OUTPUT') return 'bg-red-100 text-red-800';
  if (c === 'DISTRESS') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-800';
}

function categoryLabel(triggerType: string): string {
  const c = String(triggerType || '').toUpperCase();
  if (c === 'UNSAFE_OUTPUT') return 'HARMFUL_CONTENT';
  if (c === 'DISTRESS') return 'POLICY_VIOLATION';
  return c || 'OTHER';
}

function severityStyle(sev: string) {
  const s = String(sev || '').toUpperCase();
  if (s === 'CRITICAL' || s === 'HIGH') return 'bg-red-100 text-red-800';
  if (s === 'MEDIUM') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-800';
}

function safeInputPreview(e: AdminSafetyEvent) {
  const raw = e.inputPreview ?? '';
  const s = raw.length > 60 ? `${raw.slice(0, 60)}...` : raw;
  return s || '--';
}

export function SafetyEventTable() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [category, setCategory] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');
  const [resolvedFilter, setResolvedFilter] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data, loading, error, refresh } = useAdminSafetyEvents({
    page,
    limit,
    category: category || undefined,
    severity: severity || undefined,
    studentId: studentId.trim() ? studentId.trim() : undefined,
    resolved:
      resolvedFilter === 'true' ? true : resolvedFilter === 'false' ? false : undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
  });

  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (category) parts.push(`Category: ${category}`);
    if (severity) parts.push(`Severity: ${severity}`);
    if (from) parts.push(`From: ${from}`);
    if (to) parts.push(`To: ${to}`);
    return parts.join(' · ');
  }, [category, severity, from, to]);

  async function toggleResolved(e: AdminSafetyEvent, resolved: boolean) {
    setTogglingId(e.id);
    try {
      await patchSafetyEventResolved(e.id, resolved);
      await refresh();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Safety Events</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Review and resolve safety detections (PII, jailbreaks, harmful output).
        </p>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => { setPage(1); setCategory(e.target.value); }}
              aria-label="Category filter"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="JAILBREAK">JAILBREAK</option>
              <option value="PII">PII</option>
              <option value="UNSAFE_OUTPUT">HARMFUL_CONTENT</option>
              <option value="DISTRESS">POLICY_VIOLATION</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => { setPage(1); setSeverity(e.target.value); }}
              aria-label="Severity filter"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Student</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => { setPage(1); setStudentId(e.target.value); }}
              placeholder="studentId..."
              aria-label="StudentId filter"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Resolved</label>
            <select
              value={resolvedFilter}
              onChange={(e) => { setPage(1); setResolvedFilter(e.target.value); }}
              aria-label="Resolved filter"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="false">Unresolved</option>
              <option value="true">Resolved</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => { setPage(1); setFrom(e.target.value); }}
              aria-label="From date"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => { setPage(1); setTo(e.target.value); }}
              aria-label="To date"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rows</label>
            <select
              value={limit}
              onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }}
              aria-label="Rows per page"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {filterSummary && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {filterSummary}
          </p>
        )}
      </div>

      {/* States */}
      {loading && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">Could not load safety events.</p>
          <button
            type="button"
            onClick={() => refresh()}
            className="mt-2 text-sm font-medium text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">No safety events found</p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Time</th>
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Student</th>
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Category</th>
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Input</th>
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Severity</th>
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const isExpanded = expandedId === e.id;
                const resolved = Boolean(e.resolvedAt);
                return (
                  <React.Fragment key={e.id}>
                    <tr
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    >
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                        {formatTime(e.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-200">
                        {truncateMiddle(e.studentId, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${categoryStyle(e.triggerType)}`}>
                          {categoryLabel(e.triggerType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200 max-w-[360px]">
                        <span className="font-mono text-xs break-words">{safeInputPreview(e)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityStyle(e.severity)}`}>
                          {String(e.severity || '').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                        <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
                          <input
                            type="checkbox"
                            checked={resolved}
                            disabled={togglingId === e.id}
                            onChange={(ev) => void toggleResolved(e, ev.target.checked)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          {togglingId === e.id ? 'Saving...' : resolved ? 'Yes' : 'No'}
                        </label>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                        <td colSpan={6} className="px-4 py-4 text-xs text-gray-700 dark:text-gray-200">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="font-semibold mb-1">Event</div>
                              <div className="font-mono">id: {e.id}</div>
                              <div className="font-mono">sessionId: {e.sessionId ?? '--'}</div>
                              <div className="font-mono">turnId: {e.turnId ?? '--'}</div>
                            </div>
                            <div>
                              <div className="font-semibold mb-1">Resolution</div>
                              <div className="font-mono">resolvedAt: {e.resolvedAt ?? '--'}</div>
                              <div className="font-mono">resolution: {e.resolution ?? '--'}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Total: {total} · Page {page} / {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-medium disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-medium disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default SafetyEventTable;

