'use client';

/**
 * Admin home: descriptive dashboard reflecting current system state,
 * failure counts, recent failed jobs with links to details/retry, and quick actions.
 */

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminHome() {
  const { data: summary, error: summaryErr } = useSWR('/api/admin/content-engine/summary', fetcher, {
    refreshInterval: 30_000,
  });
  const { data: failedData } = useSWR(
    '/api/admin/content-engine/jobs?status=failed&limit=5',
    fetcher,
    { refreshInterval: 30_000 }
  );
  const failedJobs = failedData?.jobs ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Home</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Control Tower overview: job counts, recent failures, and quick links to jobs, logs, and
          retry actions.
        </p>
      </div>

      {/* Quick stats */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Job summary</h2>
        {summaryErr && (
          <p className="text-sm text-amber-600">Could not load summary. Check Engine status.</p>
        )}
        {!summaryErr && summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Queued"
              value={summary.queued ?? 0}
              sub={summary.hydration?.pending != null ? `Hydration: ${summary.hydration.pending}` : undefined}
            />
            <StatCard
              label="Running"
              value={summary.running ?? 0}
              sub={summary.hydration?.running != null ? `Hydration: ${summary.hydration.running}` : undefined}
            />
            <StatCard
              label="Failed"
              value={summary.failed ?? 0}
              sub={summary.hydration?.failed != null ? `Hydration: ${summary.hydration.failed}` : undefined}
              highlight
            />
            <StatCard label="Completed today" value={summary.completedToday ?? 0} />
          </div>
        )}
      </section>

      {/* Recent failures + retry hint */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent failed jobs</h2>
          <Link
            href="/admin/content-engine/jobs?status=failed"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all failed jobs →
          </Link>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Failures are logged per job. Open a job to see the error and use <strong>Retry</strong> or{' '}
          <strong>Requeue</strong>. For Hydrate All, use the pipeline Monitor tab and retry failed
          child jobs from there.
        </p>
        {failedJobs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No failed jobs in the list.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left py-2 pr-4 text-gray-600 dark:text-gray-400">Job ID</th>
                  <th className="text-left py-2 pr-4 text-gray-600 dark:text-gray-400">Type</th>
                  <th className="text-left py-2 pr-4 text-gray-600 dark:text-gray-400">Entity</th>
                  <th className="text-left py-2 pr-4 text-gray-600 dark:text-gray-400">Created</th>
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {failedJobs.map((job: any) => (
                  <tr key={job.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-4 font-mono text-xs truncate max-w-[140px]">
                      <Link
                        href={`/admin/content-engine/jobs/${job.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {job.id}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{job.jobType ?? '--'}</td>
                    <td className="py-2 pr-4">
                      {job.entityType}
                      {job.entityId ? ` (${String(job.entityId).slice(0, 8)}...)` : ''}
                    </td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">
                      {job.createdAt ? new Date(job.createdAt).toLocaleString() : '--'}
                    </td>
                    <td className="py-2">
                      <Link
                        href={`/admin/content-engine/jobs/${job.id}`}
                        className="inline-block px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
                      >
                        View / Retry
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quick links */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick links</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLink href="/admin/content-engine/jobs" label="Execution jobs" desc="List, filter, view details, Retry / Cancel / Requeue" />
          <QuickLink href="/admin/content-engine/hydrateAll" label="Hydrate All" desc="Submit and monitor pipeline; retry failed child jobs from Monitor" />
          <QuickLink href="/admin/content-engine/audit-logs" label="Engine audit logs" desc="Content engine execution and job events" />
          <QuickLink href="/admin/regeneration-jobs" label="Regeneration jobs" desc="Legacy regeneration job list" />
          <QuickLink href="/admin/system/alerts" label="System alerts" desc="Active and resolved alerts" />
        </ul>
      </section>

      {/* System behaviour */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">System behaviour</h2>
        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside">
          <li>All AI content starts as draft and requires approval (Content Review).</li>
          <li>Execution and Hydrate All jobs are logged; failures store <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">lastError</code> and timeline events.</li>
          <li>From <strong>Execution Jobs</strong>: open a failed job to see the error and use <strong>Retry</strong> or <strong>Requeue</strong>.</li>
          <li>From <strong>Hydrate All</strong> Monitor tab: failed child jobs show in the Failed panel with per-job and &quot;Retry all&quot; actions.</li>
          <li>Engine audit logs and Platform audit logs are available from the sidebar for deeper traces.</li>
        </ul>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
      }`}
    >
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${highlight ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function QuickLink({
  href,
  label,
  desc,
}: {
  href: string;
  label: string;
  desc: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors"
      >
        <span className="font-medium text-gray-900 dark:text-white">{label}</span>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
      </Link>
    </li>
  );
}
