'use client';
import { useEffect, useState } from 'react';

interface AuditLog {
  id: string;
  action: string;
  createdAt: string;
  user?: { email?: string };
}

export default function UserAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    fetch('/api/admin/charts/user-audit-logs')
      .then((res) => res.json())
      .then(setLogs);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8 pt-16 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold mb-4">User Audit Logs</h1>
      <table className="w-full border bg-white dark:bg-gray-800">
        <thead>
          <tr>
            <th>User Email</th>
            <th>Action</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.user?.email || 'Unknown'}</td>
              <td>{log.action}</td>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
