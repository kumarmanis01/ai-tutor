'use client';
import { useEffect, useState } from 'react';

export default function ApiUsage() {
  const [usage, setUsage] = useState([]);

  useEffect(() => {
    fetch('/api/admin/api-usage')
      .then((res) => res.json())
      .then(setUsage);
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
          {usage.map((u: any) => (
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
