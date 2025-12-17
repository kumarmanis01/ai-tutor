/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 *
 * NOTE:
 * Jobs are atomic by design.
 * There is intentionally NO pause/resume per job.
 * Retry always creates a new execution attempt.
 */

"use client";
import React, { useState } from "react";
import { alerts } from "@/lib/alerts";
import { JobStatus as JobStatusConst } from '@/lib/ai-engine/types'
// StatusBadge with JobStatus type and normalization
function StatusBadge({ status }: { status: string }) {
  let color = "bg-gray-200 text-gray-800";
  if (status === JobStatusConst.Failed) color = "bg-red-100 text-red-800";
  else if (status === JobStatusConst.Completed) color = "bg-green-100 text-green-800";
  else if (status === JobStatusConst.Pending) color = "bg-yellow-100 text-yellow-800";
  else if (status === JobStatusConst.Running) color = "bg-blue-100 text-blue-800";
  else if (status === JobStatusConst.Cancelled) color = "bg-gray-300 text-gray-500";
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{String(status).toUpperCase()}</span>
  );
}
import useSWR from "swr";
import { useParams } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function JobDetailPage() {
  const params = useParams();
//   const router = useRouter();
  const { id } = params as { id: string };
  const { data, mutate } = useSWR(id ? `/api/admin/content-engine/jobs/${id}` : null, fetcher);
  const [loading, setLoading] = useState(false);

  if (!data) return <div className="p-8">Loading...</div>;
  const job = data.job;

  const handleAction = async (action: "retry" | "cancel") => {
    if (action === "cancel") {
      if (!confirm("Cancel this job? This cannot be undone.")) return;
    }
    setLoading(true);
    const res = await fetch(`/api/admin/content-engine/jobs/${id}/${action}`, { method: "POST" });
    if (!res.ok) {
      alerts.error("Action failed. Check audit logs.");
      setLoading(false);
      return;
    }
    await mutate();
    setLoading(false);
  };

  // Guardrail helpers for allowed actions
  const canRetry: boolean = job.status === JobStatusConst.Failed;
  const canCancel: boolean = job.status === JobStatusConst.Pending || job.status === JobStatusConst.Failed;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Job Details</h1>
      <div className="bg-white rounded shadow p-4 mb-6">
        <div className="mb-2"><span className="font-semibold">Job ID:</span> {job.id}</div>
        <div className="mb-2"><span className="font-semibold">Type:</span> {job.jobType}</div>
        <div className="mb-2"><span className="font-semibold">Entity:</span> {job.entityType}{job.entityName ? ` → ${job.entityName}` : ""}</div>
        <div className="mb-2"><span className="font-semibold">Board:</span> {job.board || "-"}</div>
        <div className="mb-2"><span className="font-semibold">Class:</span> {job.classLevel || "-"}</div>
        <div className="mb-2"><span className="font-semibold">Language:</span> {job.language || "-"}</div>
        <div className="mb-2"><span className="font-semibold">Status:</span> <StatusBadge status={job.status} /></div>
        <div className="mb-2"><span className="font-semibold">Created:</span> {job.createdAt ? new Date(job.createdAt).toLocaleString() : "-"}</div>
        <div className="mb-2"><span className="font-semibold">Updated:</span> {job.updatedAt ? new Date(job.updatedAt).toLocaleString() : "-"}</div>
        <div className="mb-2"><span className="font-semibold">Retries:</span> {job.retries}</div>
      </div>
      {job.status === JobStatusConst.Failed && job.error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
          <div className="font-semibold mb-1">Error Message</div>
          <div className="text-sm text-red-700 whitespace-pre-wrap">{job.error}</div>
          <div className="text-xs text-gray-500 mt-1">
            This error was returned by the AI provider or validation layer.
          </div>
        </div>
      )}
      <div className="flex gap-4">
        {canRetry && (
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={() => handleAction("retry")}
            disabled={loading}
          >
            Retry Job
          </button>
        )}
        {canCancel && (
          <button
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            onClick={() => handleAction("cancel")}
            disabled={loading}
          >
            Cancel Job
          </button>
        )}
      </div>
      <a
        href={`/admin/content-engine/audit-logs?jobId=${job.id}`}
        className="text-sm underline text-blue-600 mt-4 inline-block"
      >
        View audit trail →
      </a>
    </div>
  );
}
