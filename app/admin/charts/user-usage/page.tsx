'use client';
import { useEffect, useState } from 'react';

interface UsageRow {
  userId: string;
  email: string;
  count: number;
}

export default function UserUsagePage() {
  const [data, setData] = useState<UsageRow[]>([]);

  useEffect(() => {
    fetch('/api/admin/charts/user-usage')
      .then((res) => res.json())
      .then(setData);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8 pt-16 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold mb-4">User API Usage</h1>
      <table className="w-full border bg-white dark:bg-gray-800">
        <thead>
          <tr>
            <th>User Email</th>
            <th>API Calls</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.userId}>
              <td>{row.email}</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
