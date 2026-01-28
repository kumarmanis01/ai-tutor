"use client";
import React, { useState } from 'react';

type WorkerRow = {
  id: string;
  type: string | null;
  status: string | null;
  lastHeartbeatAt: string | null;
  host: string | null;
  pid: number | null;
};

export default function WorkersTable({ workers }: { workers: WorkerRow[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function stopWorker(id: string) {
    if (!confirm('Stop this worker process?')) return;
    setLoadingId(id);
    try {
      const res = await fetch('/api/admin/workers/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(await res.text());
      // simple refresh to show updated list
      window.location.reload();
    } catch (e) {
      alert('Failed to stop worker: ' + (e instanceof Error ? e.message : String(e)));
      setLoadingId(null);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded shadow overflow-x-auto">
      <table className="w-full table-fixed">
        <thead className="text-left text-sm text-gray-600 dark:text-gray-300">
          <tr>
            <th className="p-3">ID</th>
            <th className="p-3">Type</th>
            <th className="p-3">Status</th>
            <th className="p-3">Last heartbeat</th>
            <th className="p-3">Host / PID</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => (
            <tr key={w.id} className="border-t border-gray-100 dark:border-gray-800">
              <td className="p-3 text-sm truncate">{w.id}</td>
              <td className="p-3 text-sm">{w.type}</td>
              <td className="p-3 text-sm">{w.status}</td>
              <td className="p-3 text-sm">{w.lastHeartbeatAt ? new Date(w.lastHeartbeatAt).toLocaleString() : '—'}</td>
              <td className="p-3 text-sm">{w.host ?? '—'} / {w.pid ?? '—'}</td>
              <td className="p-3 text-sm">
                <button
                  className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50"
                  onClick={() => stopWorker(w.id)}
                  disabled={!!loadingId}
                >
                  {loadingId === w.id ? 'Stopping…' : 'Stop'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
