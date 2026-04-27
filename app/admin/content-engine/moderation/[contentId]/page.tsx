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
import { useParams, useRouter } from "next/navigation";
import { JobStatus, ApprovalStatus } from '@/lib/ai-engine/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ContentReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { contentId } = params as { contentId: string };
  const { data, isLoading, error } = useSWR(contentId ? `/api/admin/moderation/content/${contentId}` : null, fetcher);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  type ContentStatus = "pending" | "approved" | "rejected";

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">Error loading content.</div>;

  if (!data?.content) return <div className="p-8">Content not found.</div>;
  const { content } = data;
  const status = content.status as ContentStatus;

  // Centralized allowed transitions
  const canApprove = status === JobStatus.Pending;
  const canReject = status === JobStatus.Pending;
  const canRollback = status !== JobStatus.Pending;

  /**
   * Moderation rules:
   * - Only PENDING content can be approved or rejected
   * - Rollback is only allowed for approved/rejected content
   * - Every action must be audited
   * - No auto-approval ever
   */
  const handleAction = async (action: "approve" | "reject" | "rollback") => {
    if (action === "reject" || action === "rollback") {
      if (!confirm("Are you sure? This action will be logged.")) return;
    }
    setLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/moderation/content/${contentId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const errorMsg = "Action failed";
      let json = null;
      try { json = await res.json(); } catch {}
      if (!res.ok) throw new Error(json?.error || errorMsg);
      router.push("/admin/content-engine/moderation");
    } catch (e: any) {
      setActionError(e.message || "Action failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Content Review</h1>
      {/* Metadata */}
      <div className="bg-white rounded shadow p-4 mb-6">
        <div className="mb-2"><span className="font-semibold">Board:</span> {content.board || "-"}</div>
        <div className="mb-2"><span className="font-semibold">Class:</span> {content.classLevel || "-"}</div>
        <div className="mb-2"><span className="font-semibold">Subject:</span> {content.subject || "-"}</div>
        <div className="mb-2"><span className="font-semibold">Topic:</span> {content.topicName || "-"}</div>
        <div className="mb-2 flex items-center gap-2"><span className="font-semibold">Language:</span> <span className="inline-block px-2 py-1 bg-slate-100 rounded text-xs">{content.language}</span></div>
        <div className="mb-2"><span className="font-semibold">Generated At:</span> {content.createdAt ? new Date(content.createdAt).toLocaleDateString() : "-"}</div>
        <div className="mb-2"><span className="font-semibold">Status:</span> <span className={`px-2 py-1 rounded text-xs font-semibold ${status === JobStatus.Pending ? "bg-yellow-100 text-yellow-800" : status === ApprovalStatus.Approved ? "bg-green-100 text-green-800" : status === ApprovalStatus.Rejected ? "bg-red-100 text-red-800" : "bg-gray-200 text-gray-800"}`}>{status}</span></div>
      </div>
      {/* Content Preview */}
      <div className="mb-6">
        <div className="font-semibold mb-2">Content Preview</div>
        {/* Content is read-only here. Editing happens via regeneration, not mutation. */}
        <div className="p-4 bg-gray-50 rounded border text-sm whitespace-pre-wrap min-h-[120px]">{content.body}</div>
      </div>
      {/* Moderation Actions */}
      <div className="mb-4">
        <div className="font-semibold mb-2">Moderation Actions</div>
        <textarea
          className="w-full p-2 border rounded mb-2 text-sm"
          placeholder="Optional comment (will be logged)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={2}
          disabled={loading || status !== JobStatus.Pending}
        />
        {actionError && <div className="text-red-600 text-sm mb-2">{actionError}</div>}
        <div className="flex gap-4 items-center">
          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            onClick={() => handleAction("approve")}
            disabled={loading || !canApprove}
          >
            Approve
          </button>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            onClick={() => handleAction("reject")}
            disabled={loading || !canReject}
          >
            Reject
          </button>
          <div className="flex flex-col items-start">
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
              onClick={() => handleAction("rollback")}
              disabled={loading || !canRollback}
            >
              Rollback to Previous
            </button>
            <span className="text-xs text-gray-500 mt-1">Reverts to last approved version</span>
          </div>
        </div>
      </div>
      {status !== JobStatus.Pending && (
        <div className="text-gray-500">This content has already been {status}.</div>
      )}
      <a
        href={`/admin/content-engine/audit-logs?contentId=${contentId}`}
        className="text-sm underline text-blue-600 mt-4 inline-block"
      >
        View moderation history →
      </a>
      {content.lastApprovedAt && (
        <div className="text-xs text-gray-500">
          Last approved on {new Date(content.lastApprovedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
