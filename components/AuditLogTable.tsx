import React from 'react';

interface AuditLog {
  id: string;
  user?: { email?: string };
  action: string;
  details?: object;
  createdAt: string;
}

interface AuditLogTableProps {
  logs: AuditLog[];
}

const AuditLogTable: React.FC<AuditLogTableProps> = ({ logs }) => {
  return (
    <div className="overflow-x-auto">
      <table className="table-auto w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2">User</th>
            <th className="border border-gray-300 px-4 py-2">Action</th>
            <th className="border border-gray-300 px-4 py-2">Details</th>
            <th className="border border-gray-300 px-4 py-2">Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">{log.user?.email || 'System'}</td>
              <td className="border border-gray-300 px-4 py-2">{log.action}</td>
              <td className="border border-gray-300 px-4 py-2">
                {log.details ? JSON.stringify(log.details) : 'N/A'}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {new Date(log.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AuditLogTable;
