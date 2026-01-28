"use client";

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import JobActions from '@/components/Admin/JobActions';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function JobsIndexPage() {
  const [status, setStatus] = useState<string | ''>('');
  const [jobType, setJobType] = useState<string | ''>('');
  const [entityType, setEntityType] = useState<string | ''>('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState<number>(25);
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const metaSWR = useSWR('/api/admin/content-engine/meta', fetcher);
  const meta = metaSWR.data;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (jobType) params.set('jobType', jobType);
    if (entityType) params.set('entityType', entityType);
    if (q) params.set('q', q);
    if (limit) params.set('limit', String(limit));
    if (cursor) params.set('cursor', cursor);
    return '/api/admin/content-engine/jobs?' + params.toString();
  }, [status, jobType, entityType, q, limit, cursor]);

  const { data, error, mutate } = useSWR(query, fetcher);

  function applyFilters() {
    setHistory([]);
    setCursor(null);
    mutate();
  }

  async function gotoNext() {
    if (!data?.nextCursor) return;
    setHistory((h) => [...h, cursor || '']);
    setCursor(data.nextCursor);
  }

  function gotoPrev() {
    const prev = history[history.length - 1] ?? null;
    setHistory((h) => h.slice(0, Math.max(0, h.length - 1)));
    setCursor(prev || null);
  }

  if (error) return <div className="p-4 text-red-600">Failed to load jobs.</div>;
  if (!data) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Content Generation Jobs</h1>

      <div className="mb-4 flex gap-2 items-end">
        <div>
          <label className="text-xs">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="ml-2 border px-2 py-1">
            <option value="">Any</option>
            {meta?.statuses?.map((s: string) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs">Job Type</label>
          <select value={jobType} onChange={(e) => setJobType(e.target.value)} className="ml-2 border px-2 py-1">
            <option value="">Any</option>
            {meta?.jobTypes?.map((jt: string) => (
              <option key={jt} value={jt}>{jt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs">Entity Type</label>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="ml-2 border px-2 py-1">
            <option value="">Any</option>
            {meta?.entityTypes?.map((et: string) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs">Search</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="job id or entity id" className="ml-2 border px-2 py-1" />
        </div>

        <div>
          <label className="text-xs">Limit</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="ml-2 border px-2 py-1">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={applyFilters}>Apply</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 border">ID</th>
              <th className="px-3 py-2 border">Job Type</th>
              <th className="px-3 py-2 border">Entity</th>
              <th className="px-3 py-2 border">Status</th>
              <th className="px-3 py-2 border">Created At</th>
              <th className="px-3 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.jobs?.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center p-4">
                  No jobs found.
                </td>
              </tr>
            )}
            {data.jobs?.map((job: any) => (
              <tr key={job.id} className="border-b">
                <td className="px-3 py-2 border truncate max-w-xs">
                  <Link href={`/admin/content-engine/jobs/${job.id}`} className="text-blue-600">
                    {job.id}
                  </Link>
                </td>
                <td className="px-3 py-2 border">{job.jobType}</td>
                <td className="px-3 py-2 border">{job.entityType}{job.entityName ? `: ${job.entityName}` : ''}</td>
                <td className="px-3 py-2 border">{job.status}</td>
                <td className="px-3 py-2 border">{new Date(job.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 border">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/content-engine/jobs/${job.id}`} className="text-sm text-blue-600">View</Link>
                    <JobActions jobId={job.id} status={job.status} onDone={() => mutate()} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-2">
        <button className="px-3 py-1 border rounded" onClick={gotoPrev} disabled={history.length === 0}>
          Previous
        </button>
        <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={gotoNext} disabled={!data?.nextCursor}>
          Next
        </button>
      </div>
    </div>
  );
}
