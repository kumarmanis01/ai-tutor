// app/dashboard/page.tsx
"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Dashboard() {
  const { data, error } = useSWR("/api/admin/metrics", fetcher, { refreshInterval: 15000 });

  if (error) return <div className="p-6 text-red-600">Failed to load metrics</div>;
  if (!data) return <div className="p-6">Loading metrics…</div>;

  const { userCount, totalChats, totalEvents, activeUsers, messagesPerDay } = data;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin — Usage Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Total Users</div>
          <div className="text-2xl font-semibold">{userCount}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Total Chats</div>
          <div className="text-2xl font-semibold">{totalChats}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Events Logged</div>
          <div className="text-2xl font-semibold">{totalEvents}</div>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Active Users (last 7 days)</h2>
        <ul className="space-y-2">
          {activeUsers.length === 0 ? (
            <li className="text-sm text-gray-500">No active users</li>
          ) : (
            activeUsers.map((u: any, idx: number) => (
              <li key={idx} className="p-2 bg-white rounded shadow">
                <div>User ID: <span className="font-mono">{u.userId}</span></div>
                <div>Messages: <strong>{u.count}</strong></div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Messages per day (last 7 days)</h2>
        <ul className="space-y-1">
          {messagesPerDay && messagesPerDay.length ? (
            messagesPerDay.map((r: any, i: number) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{r.day}</span>: {r.count}
              </li>
            ))
          ) : (
            <li className="text-sm text-gray-500">No message data</li>
          )}
        </ul>
      </section>
    </div>
  );
}
