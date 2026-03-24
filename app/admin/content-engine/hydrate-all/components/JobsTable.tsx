'use client';

import { useState, useEffect } from 'react';

interface JobsTableProps {
  onSelectJob: (jobId: string) => void;
}

interface JobSummary {
  id: string;
  status: string;
  metadata: {
    board: string;
    grade: number;
    subject: string;
    language: string;
  };
  createdAt: string;
  progress: {
    overall: number;
  };
  cost: {
    actual: number | null;
  };
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    running: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    paused: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-gray-100 text-gray-600',
    pending: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function JobActions({ job, onAction }: { job: JobSummary; onAction: () => void }) {
  const [busy, setBusy] = useState(false);

  const call = async (url: string, method: string) => {
    setBusy(true);
    try {
      await fetch(url, { method });
      onAction();
    } finally {
      setBusy(false);
    }
  };

  if (job.status === 'running' || job.status === 'pending') {
    return (
      <div className="flex gap-2 justify-end">
        <button
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); call(`/api/admin/hydrateAll/${job.id}/pause`, 'POST'); }}
          className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 disabled:opacity-50 min-h-[28px]"
        >
          Pause
        </button>
        <button
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); call(`/api/admin/hydrateAll/${job.id}`, 'DELETE'); }}
          className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50 min-h-[28px]"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (job.status === 'paused') {
    return (
      <div className="flex gap-2 justify-end">
        <button
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); call(`/api/admin/hydrateAll/${job.id}/resume`, 'POST'); }}
          className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 disabled:opacity-50 min-h-[28px]"
        >
          Resume
        </button>
        <button
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); call(`/api/admin/hydrateAll/${job.id}`, 'DELETE'); }}
          className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50 min-h-[28px]"
        >
          Cancel
        </button>
      </div>
    );
  }

  return <span className="text-xs text-gray-400">{job.status}</span>;
}

export default function JobsTable({ onSelectJob }: JobsTableProps) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await fetch(`/api/admin/hydrateAll?${params}`);
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch {
      // silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 py-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 rounded" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button onClick={fetchJobs} className="text-sm text-blue-600 hover:text-blue-500">
          Refresh
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No jobs found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onSelectJob(job.id)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {job.metadata.subject} - Grade {job.metadata.grade}
                    </div>
                    <div className="text-sm text-gray-500">
                      {job.metadata.board} | {job.metadata.language.toUpperCase()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{job.progress.overall}%</div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${job.progress.overall}%` }} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${job.cost.actual?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(job.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <JobActions job={job} onAction={fetchJobs} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
