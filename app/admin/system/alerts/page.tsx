"use client";

import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SystemAlertsPage() {
  const [includeResolved, setIncludeResolved] = useState(false);
  const { data, error, isLoading } = useSWR(`/api/admin/system/alerts?includeResolved=${includeResolved ? '1' : '0'}`, fetcher);

  if (isLoading) return <div>Loading alerts…</div>;
  if (error) return <div>Error loading alerts</div>;

  const alerts = data?.alerts ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">System Alerts</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeResolved} onChange={(e) => setIncludeResolved(e.target.checked)} />
          <span className="text-sm">Include resolved</span>
        </label>
      </div>

      <div className="bg-white shadow rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Severity</th>
              <th className="p-3 text-left">Message</th>
              <th className="p-3 text-left">Active</th>
              <th className="p-3 text-left">First Seen</th>
              <th className="p-3 text-left">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">No alerts</td>
              </tr>
            )}
            {alerts.map((a: any) => (
              <tr key={a.id} className="border-t">
                <td className="p-3">{a.type}</td>
                <td className="p-3">{a.severity}</td>
                <td className="p-3">{a.message}</td>
                <td className="p-3">{a.active ? 'Yes' : 'No'}</td>
                <td className="p-3">{new Date(a.firstSeen).toLocaleString()}</td>
                <td className="p-3">{new Date(a.lastSeen).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
