"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Admin dashboard to monitor usage
 * Shows active users, total messages
 */
export default function AdminDashboard() {
  const { data, error } = useSWR("/api/admin/metrics", fetcher);

  if (error) return <div className="p-6 text-red-500">Failed to load metrics</div>;
  if (!data) return <div className="p-6">Loading metrics...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📊 Admin Dashboard</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">Active Users</h2>
          <p className="text-xl">{data.activeUsers}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">Total Messages</h2>
          <p className="text-xl">{data.totalMessages}</p>
        </div>
      </div>
    </div>
  );
}
