"use client";
/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 */

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AuditLogsIndexPage() {
  const { data, error } = useSWR('/api/admin/content-engine/audit-logs', fetcher);

  if (error) return <div className="p-4 text-red-600">Failed to load audit logs.</div>;
  if (!data) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Approval Audit Trail</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 border">Action</th>
              <th className="px-3 py-2 border">Admin</th>
              <th className="px-3 py-2 border">Entity</th>
              <th className="px-3 py-2 border">Comment</th>
              <th className="px-3 py-2 border">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {data.logs?.length === 0 && (
              <tr><td colSpan={5} className="text-center p-4">No audit logs found.</td></tr>
            )}
            {data.logs?.map((log: any) => (
              <tr key={log.id} className="border-b">
                <td className="px-3 py-2 border">{log.action}</td>
                <td className="px-3 py-2 border">{log.adminEmail || log.adminId}</td>
                <td className="px-3 py-2 border">{log.entityType}{log.entityId ? `: ${log.entityId}` : ''}</td>
                <td className="px-3 py-2 border">{log.comment || '-'}</td>
                <td className="px-3 py-2 border">{new Date(log.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
