"use client";

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import JobActions from '@/components/Admin/JobActions';
import { JobStatus as JobStatusConst } from '@/lib/ai-engine/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function StatusBadge({ status }: { status: string }) {
  let color = 'bg-gray-200 text-gray-800';
  if (status === JobStatusConst.Failed) color = 'bg-red-100 text-red-800';
  else if (status === JobStatusConst.Completed) color = 'bg-green-100 text-green-800';
  else if (status === JobStatusConst.Pending) color = 'bg-yellow-100 text-yellow-800';
  else if (status === JobStatusConst.Running) color = 'bg-blue-100 text-blue-800';
  else if (status === JobStatusConst.Cancelled) color = 'bg-gray-300 text-gray-500';
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{String(status).toUpperCase()}</span>;
}

import { useParams } from 'next/navigation';

export default function JobDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const { data: jobRes, error: jobErr, mutate: mutateJob } = useSWR(id ? `/api/admin/content-engine/jobs/${id}` : null, fetcher);
  const { data: timelineRes, mutate: mutateTimeline } = useSWR(id ? `/api/admin/content-engine/jobs/${id}/timeline` : null, fetcher);
  const [errorsOnly, setErrorsOnly] = useState(false);

  const job = jobRes?.job;

  const displayedLogs = useMemo(() => {
    const logs = timelineRes?.logs ?? [];
    if (!errorsOnly) return logs;
    return logs.filter((l: any) => l.message || String(l.event).toUpperCase().includes('FAIL'));
  }, [timelineRes, errorsOnly]);

  if (jobErr) return <div className="p-6 text-red-600">Failed to load job.</div>;
  if (!job) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Job {job.id}</h1>
          <div className="text-sm text-gray-600">{job.jobType} — {job.entityType} {job.entityName ? `→ ${job.entityName}` : ''}</div>
        </div>
        <div>
          <JobActions jobId={job.id} status={job.status} onDone={() => { mutateJob(); mutateTimeline(); }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded shadow p-4">
          <div className="text-xs text-gray-500">Status</div>
          <div className="mt-2"><StatusBadge status={job.status} /></div>
        </div>
        <div className="bg-white rounded shadow p-4">
          <div className="text-xs text-gray-500">Timestamps</div>
          <div className="mt-2 text-sm">Created: {job.createdAt ? new Date(job.createdAt).toLocaleString() : '-'}</div>
          <div className="mt-1 text-sm">Updated: {job.updatedAt ? new Date(job.updatedAt).toLocaleString() : '-'}</div>
        </div>
      </div>

      {job.status === JobStatusConst.Failed && job.error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
          <div className="font-semibold mb-1">Error Message</div>
          <div className="text-sm text-red-700 whitespace-pre-wrap">{job.error}</div>
          <div className="text-xs text-gray-500 mt-1">This error was returned by the worker or provider.</div>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-medium">Timeline</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm">Errors only</label>
          <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        {displayedLogs.length === 0 && <div className="text-sm text-gray-500">No events yet.</div>}
        <ol className="space-y-3">
          {displayedLogs.map((l: any) => (
            <li key={l.id} className="flex gap-3">
              <div className="w-10 flex-none text-center">
                <span className="text-lg">
                  {String(l.event).toUpperCase().includes('FAILED') ? '❌' : String(l.event).toUpperCase().includes('RUNNING') ? '▶️' : String(l.event).toUpperCase().includes('COMPLETED') ? '✅' : '●'}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-500">{new Date(l.createdAt).toLocaleString()}</div>
                <div className="font-medium">{l.event}</div>
                {l.message && <div className="text-sm text-red-700 whitespace-pre-wrap">{l.message}</div>}
                {l.meta && <pre className="text-xs mt-1 whitespace-pre-wrap bg-gray-50 p-2 rounded">{JSON.stringify(l.meta, null, 2)}</pre>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6">
        <a href={`/admin/content-engine/audit-logs?jobId=${job.id}`} className="text-sm underline text-blue-600">View audit trail →</a>
      </div>
    </div>
  );
}
