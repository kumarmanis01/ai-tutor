'use client';
import { useEffect, useState } from 'react';
import AuditTrailViewer from '../../../components/AuditTrailViewer';

interface AuditLog {
  id: string;
  user?: { email?: string };
  action: string;
  details?: object;
  createdAt: string;
}

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    fetch('/api/admin/audit-logs')
      .then((res) => res.json())
      .then((data: AuditLog[]) => setLogs(data));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Audit Logs</h1>
      <AuditTrailViewer />
      <table className="w-full border">
        <thead>
          <tr>
            <th>User</th>
            <th>Action</th>
            <th>Details</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.user?.email || 'System'}</td>
              <td>{log.action}</td>
              <td>{log.details ? JSON.stringify(log.details) : ''}</td>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AuditLogsPage;
