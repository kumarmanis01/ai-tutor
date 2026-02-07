/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 */

"use client";
import React, { useState } from "react";
import useSWR from "swr";
import { alerts } from "@/lib/alerts";
import { JobStatus } from '@/lib/ai-engine/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function StatusBadge({ status }: { status: string }) {
  let color = "bg-gray-200 text-gray-800";
  switch (status) {
    case "running": color = "bg-green-100 text-green-800"; break;
    case "pending": color = "bg-blue-100 text-blue-800"; break;
    case "failed": color = "bg-red-100 text-red-800"; break;
    case "completed": color = "bg-gray-300 text-gray-900"; break;
    case "paused": color = "bg-yellow-100 text-yellow-800"; break;
  }
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{status?.toUpperCase() || "UNKNOWN"}</span>;
}

export default function AIDashboard() {
  const { data: statusData, mutate: mutateStatus } = useSWR("/api/admin/content-engine/status", fetcher, { refreshInterval: 5000 });
  const { data: summary } = useSWR("/api/admin/content-engine/summary", fetcher, { refreshInterval: 5000 });
  const { data: jobs, mutate: mutateJobs } = useSWR("/api/admin/content-engine/jobs?limit=10", fetcher, { refreshInterval: 5000 });
  const [loading, setLoading] = useState(false);
  const isBusy = loading;


  const handlePause = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/content-engine/pause", { method: "POST" });
    if (!res.ok) {
      alerts.error("Failed to pause engine. Check audit logs.");
    } else {
      alerts.success("AI engine paused successfully.");
    }
    await mutateStatus();
    setLoading(false);
  };

  const handleResume = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/content-engine/resume", { method: "POST" });
    if (!res.ok) {
      alerts.error("Failed to resume engine. Check audit logs.");
    } else {
      alerts.success("AI engine resumed.");
    }
    await mutateStatus();
    setLoading(false);
  };

  const cancelJob = (jobId: string) => {
    alerts.confirm(
      "Cancel this job? This cannot be undone.",
      async () => {
        setLoading(true);
        const res = await fetch(`/api/admin/content-engine/jobs/${jobId}/cancel`, { method: "POST" });
        if (!res.ok) {
          alerts.error("Failed to cancel job.");
        } else {
          alerts.success("Job cancelled.");
          await mutateJobs();
        }
        setLoading(false);
      },
      "Cancel Job",
      "Yes, cancel"
    );
  };

  const retryJob = async (jobId: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/content-engine/jobs/${jobId}/retry`, { method: "POST" });
    if (!res.ok) {
      alerts.error("Failed to retry job.");
    } else {
      alerts.success("Job retried.");
      await mutateJobs();
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">AI Content Engine</h1>
      <div className="flex items-center gap-4 mb-2">
        <div className="font-semibold">Status:</div>
        <StatusBadge status={statusData?.status} />
        {statusData?.status === JobStatus.Running && (
          <button
            className="ml-4 px-4 py-2 bg-yellow-500 text-white rounded disabled:opacity-50"
            onClick={handlePause}
            disabled={isBusy}
          >
            Pause Engine
          </button>
        )}
        {statusData?.status === "paused" && (
          <button
            className="ml-4 px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            onClick={handleResume}
            disabled={isBusy}
          >
            Resume Engine
          </button>
        )}
        <a href="/admin/content-engine/audit-logs" className="ml-auto text-xs underline text-blue-700">View audit logs →</a>
      </div>
      <p className="text-xs text-gray-500 mt-1 mb-6">
        Pausing stops new jobs from starting. Running jobs finish safely.
      </p>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded shadow p-4 text-center">
          <div className="text-sm text-gray-500">Queued Jobs</div>
          <div className="text-2xl font-bold">{summary?.queued ?? "-"}</div>
        </div>
        <div className="bg-white rounded shadow p-4 text-center">
          <div className="text-sm text-gray-500">Running</div>
          <div className="text-2xl font-bold">{summary?.running ?? "-"}</div>
        </div>
        <div className="bg-white rounded shadow p-4 text-center">
          <div className="text-sm text-gray-500">Failed</div>
          <div className="text-2xl font-bold">{summary?.failed ?? "-"}</div>
        </div>
        <div className="bg-white rounded shadow p-4 text-center">
          <div className="text-sm text-gray-500">Completed Today</div>
          <div className="text-2xl font-bold">{summary?.completedToday ?? "-"}</div>
        </div>
      </div>
      {/* HydrateAll Pipeline & Content Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">HydrateAll Pipeline</div>
            <a href="/admin/content-engine/hydrateAll" className="text-xs text-blue-600 underline">Open Pipeline →</a>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-blue-50 rounded p-2 text-center">
              <div className="text-gray-500">Pending</div>
              <div className="text-lg font-bold text-blue-700">{summary?.hydration?.pending ?? "-"}</div>
            </div>
            <div className="bg-green-50 rounded p-2 text-center">
              <div className="text-gray-500">Running</div>
              <div className="text-lg font-bold text-green-700">{summary?.hydration?.running ?? "-"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="text-gray-500">Completed</div>
              <div className="text-lg font-bold text-gray-700">{summary?.hydration?.completed ?? "-"}</div>
            </div>
            <div className="bg-red-50 rounded p-2 text-center">
              <div className="text-gray-500">Failed</div>
              <div className="text-lg font-bold text-red-700">{summary?.hydration?.failed ?? "-"}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Generated Content</div>
            <a href="/admin/content-central" className="text-xs text-blue-600 underline">Content Central →</a>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-indigo-50 rounded p-2 text-center">
              <div className="text-gray-500">Chapters</div>
              <div className="text-lg font-bold text-indigo-700">{summary?.content?.chapters ?? "-"}</div>
            </div>
            <div className="bg-purple-50 rounded p-2 text-center">
              <div className="text-gray-500">Topics</div>
              <div className="text-lg font-bold text-purple-700">{summary?.content?.topics ?? "-"}</div>
            </div>
            <div className="bg-teal-50 rounded p-2 text-center">
              <div className="text-gray-500">Notes</div>
              <div className="text-lg font-bold text-teal-700">{summary?.content?.notes ?? "-"}</div>
            </div>
            <div className="bg-amber-50 rounded p-2 text-center">
              <div className="text-gray-500">Questions</div>
              <div className="text-lg font-bold text-amber-700">{summary?.content?.questions ?? "-"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Jobs Table */}
      <div className="bg-white rounded shadow p-4">
        <div className="font-semibold mb-2">Recent Jobs</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Job ID</th>
              <th className="py-2 text-left">Type</th>
              <th className="py-2 text-left">Entity</th>
              <th className="py-2 text-left">Lang</th>
              <th className="py-2 text-left">Status</th>
              <th className="py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs?.jobs?.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-gray-500">No jobs found.</td></tr>
            )}
            {jobs?.jobs?.map((job: any) => (
              <tr key={job.id} className="border-b">
                <td className="py-2">{job.id}</td>
                <td className="py-2">{job.jobType}</td>
                <td className="py-2">{job.entityType}{job.entityName ? `: ${job.entityName}` : ""}</td>
                <td className="py-2">{job.language?.toUpperCase() || "-"}</td>
                <td className="py-2">
                  <StatusBadge status={job.status} />
                </td>
                <td className="py-2 flex gap-2 flex-wrap">
                  {job.status === JobStatus.Pending && (
                    <button
                      className="px-2 py-1 bg-red-500 text-white rounded"
                      onClick={() => cancelJob(job.id)}
                      disabled={isBusy}
                    >
                      Cancel
                    </button>
                  )}
                  {job.status === JobStatus.Failed && (
                    <button
                      className="px-2 py-1 bg-blue-500 text-white rounded"
                      onClick={() => retryJob(job.id)}
                      disabled={isBusy}
                    >
                      Retry
                    </button>
                  )}
                  {job.status === JobStatus.Completed && (
                    <>
                      <a href={`/admin/content-engine/jobs/${job.id}`} className="px-2 py-1 bg-gray-500 text-white rounded">View</a>
                      {job.contentId && (
                        <a href={`/admin/content-engine/moderation/${job.contentId}`} className="px-2 py-1 bg-green-600 text-white rounded">Review Content</a>
                      )}
                    </>
                  )}
                  <a href={`/admin/content-engine/jobs/${job.id}`} className="px-2 py-1 bg-slate-200 text-gray-800 rounded">Details</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
