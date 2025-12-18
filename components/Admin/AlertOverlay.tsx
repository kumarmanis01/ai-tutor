"use client";
import React from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AlertOverlay() {
  const { data } = useSWR('/api/admin/system/alerts?activeOnly=true', fetcher, { refreshInterval: 30000 });
  const alerts = data?.alerts ?? [];
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="fixed left-4 top-16 z-50 w-96">
      <div className="bg-white border rounded shadow p-3">
        <div className="text-sm font-semibold mb-2">Active alerts</div>
        <ul className="space-y-2 max-h-80 overflow-auto">
          {alerts.map((a: any) => (
            <li key={a.id} className="flex items-start gap-2">
              <div className={`w-3 h-3 rounded-full ${a.severity === 'CRITICAL' ? 'bg-red-600' : a.severity === 'WARNING' ? 'bg-yellow-500' : 'bg-blue-400'}`} />
              <div>
                <div className="text-sm font-medium">{a.type}</div>
                <div className="text-xs text-gray-600">{a.message}</div>
                <div className="text-xs text-gray-400">First: {new Date(a.firstSeen).toLocaleString()}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
