'use client';

import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminContentQualityPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [historyData, setHistoryData] = useState<{ history: { id: string; entityType: string; entityId: string; fromStatus: string; toStatus: string; reason: string | null; createdAt: string }[] } | null>(null);

  const summaryUrl = [from, to].some(Boolean)
    ? `/api/admin/content-quality/summary?${from ? `from=${encodeURIComponent(from)}` : ''}${to ? `&to=${encodeURIComponent(to)}` : ''}`
    : '/api/admin/content-quality/summary';
  const { data: summary } = useSWR(summaryUrl, fetcher);
  const { data: pending } = useSWR('/api/admin/content-quality/pending', fetcher);

  const fetchHistory = async () => {
    if (!entityType || !entityId) return;
    const res = await fetch(
      `/api/admin/content-quality/history?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
    );
    const data = await res.json();
    setHistoryData(data);
  };

  const byType = summary?.byType ?? {};
  const rejectionReasons = summary?.rejectionReasons ?? [];
  const pendingByType = pending?.byType ?? {};

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Quality Monitoring</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Approval/rejection summary from ApprovalAudit, pending draft counts, and per-entity moderation history.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Approved</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary?.approved ?? '--'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Rejected</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary?.rejected ?? '--'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total pending (draft)</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{pending?.totalPending ?? '--'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Oldest pending</div>
          <div className="text-sm">{pending?.oldestPendingAt ? new Date(pending.oldestPendingAt).toLocaleDateString() : '--'}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium">Summary date range:</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">By type (approve / reject)</h2>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Type</th>
                <th className="p-3 text-left font-medium">Approved</th>
                <th className="p-3 text-left font-medium">Rejected</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byType).length === 0 && (
                <tr><td colSpan={3} className="p-4 text-center text-gray-500">No data</td></tr>
              )}
              {Object.entries(byType).map(([type, v]) => (
                <tr key={type} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">{type}</td>
                  <td className="p-3">{v.approved}</td>
                  <td className="p-3">{v.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Pending by type (draft counts)</h2>
        <div className="flex flex-wrap gap-4">
          {Object.entries(pendingByType).map(([type, count]) => (
            <span key={type} className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-sm">
              {type}: {count}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Top rejection reasons</h2>
        <ul className="list-disc list-inside text-sm space-y-1">
          {rejectionReasons.length === 0 && <li className="text-gray-500">None</li>}
          {rejectionReasons.slice(0, 10).map((r: { reason: string; count: number }, i: number) => (
            <li key={i}>{r.reason} ({r.count})</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Moderation history for entity</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Entity type (e.g. topic, chapter)"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
          />
          <input
            type="text"
            placeholder="Entity ID"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={fetchHistory}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium"
          >
            Load history
          </button>
        </div>
        {historyData && (
          <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="p-3 text-left font-medium">From → To</th>
                  <th className="p-3 text-left font-medium">Reason</th>
                  <th className="p-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {historyData.history?.length === 0 && (
                  <tr><td colSpan={3} className="p-4 text-center text-gray-500">No history</td></tr>
                )}
                {historyData.history?.map((h: { id: string; fromStatus: string; toStatus: string; reason: string | null; createdAt: string }) => (
                  <tr key={h.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-3">{h.fromStatus} → {h.toStatus}</td>
                    <td className="p-3">{h.reason ?? '--'}</td>
                    <td className="p-3">{new Date(h.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
