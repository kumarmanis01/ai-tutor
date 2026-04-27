"use client";

import React, { useEffect, useState } from 'react';

/**
 * TestHistory
 *
 * Lists recent attempts for the current user via `/api/tests/history`.
 */
export default function TestHistory() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch('/api/tests/history');
      const json = await res.json();
      if (mounted) setItems(json.attempts ?? []);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="rounded-lg border p-4 bg-white shadow-sm">
      <h3 className="text-lg font-semibold">Test History</h3>
      <ul className="mt-2 space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded border p-2">
            <div>
              <p className="text-sm">{a.testId}</p>
              <p className="text-xs text-gray-600">{a.finishedAt ? new Date(a.finishedAt).toLocaleString() : 'In progress'}</p>
            </div>
            <div className="text-sm font-medium">{a.scorePercent != null ? `${Math.round(a.scorePercent)}%` : '-'}</div>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-gray-600">No attempts yet.</li>}
      </ul>
    </div>
  );
}
