'use client';
import { useEffect, useState } from 'react';

interface ApiUsage {
  id: string;
  user?: { email?: string };
  endpoint: string;
  count: number;
  lastUsed: string;
}

export default function ApiUsagePage() {
  const [usage, setUsage] = useState<ApiUsage[]>([]);

  useEffect(() => {
    fetch('/api/admin/api-usage')
      .then((res) => res.json())
      .then((data: ApiUsage[]) => setUsage(data));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">API Usage</h1>
      <table className="w-full border">
        <thead>
          <tr>
            <th>User</th>
            <th>Endpoint</th>
            <th>Count</th>
            <th>Last Used</th>
          </tr>
        </thead>
        <tbody>
          {usage.map((u) => (
            <tr key={u.id}>
              <td>{u.user?.email || 'Anonymous'}</td>
              <td>{u.endpoint}</td>
              <td>{u.count}</td>
              <td>{new Date(u.lastUsed).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
