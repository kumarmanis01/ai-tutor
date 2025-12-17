"use client"
import React, { useEffect, useState } from "react";
import { JobStatus, ApprovalStatus } from '@/lib/ai-engine/types'

function StatusBadge({ status }: { status: string }) {
  const color =
    status === ApprovalStatus.Approved
      ? "bg-green-200 text-green-800"
      : status === JobStatus.Pending
      ? "bg-yellow-200 text-yellow-800"
      : status === ApprovalStatus.Rejected
      ? "bg-red-200 text-red-800"
      : "bg-gray-200 text-gray-800";
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{status}</span>;
}

function ModerationActions({ chapter, refresh }: { chapter: any; refresh: () => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [showAudit, setShowAudit] = useState(false);

  const handleAction = async (action: string) => {
    if (confirm !== action) {
      setConfirm(action);
      setTimeout(() => setConfirm(null), 2000);
      return;
    }
    const url = `/api/admin/chapters/${chapter.id}/${action}`;
    const method = "POST";
    let body: any = undefined;
    if (action === "reject") {
      body = JSON.stringify({ reason: "Rejected by admin" });
    }
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body });
    setConfirm(null);
    refresh();
  };

  const fetchAudit = async () => {
    const res = await fetch(`/api/admin/audit-logs?entityType=chapter&entityId=${chapter.id}`);
    if (res.ok) setAudit(await res.json());
    setShowAudit(true);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button className="text-green-600" onClick={() => handleAction("approve")}>
          {confirm === "approve" ? "Confirm Approve" : "Approve"}
        </button>
        <button className="text-red-600" onClick={() => handleAction("reject")}>
          {confirm === "reject" ? "Confirm Reject" : "Reject"}
        </button>
      </div>
      <button className="text-xs text-blue-600 underline" onClick={fetchAudit}>
        View Audit Log
      </button>
      {showAudit && (
        <div className="bg-gray-50 border p-2 mt-1 max-w-xs">
          <div className="font-bold mb-1">Audit Log</div>
          {audit.length === 0 ? (
            <div>No audit entries.</div>
          ) : (
            <ul className="text-xs">
              {audit.map((entry: any) => (
                <li key={entry.id}>
                  {entry.fromStatus} → {entry.toStatus} by {entry.actorId || "admin"} ({new Date(entry.createdAt).toLocaleString()})
                </li>
              ))}
            </ul>
          )}
          <button className="text-xs text-gray-600 mt-1" onClick={() => setShowAudit(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChaptersClient() {
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChapters = () => {
    setLoading(true);
    fetch("/api/chapters")
      .then((res) => res.json())
      .then((data) => {
        setChapters(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchChapters();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Chapters</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-4 py-2">Name</th>
              <th className="border px-4 py-2">Slug</th>
              <th className="border px-4 py-2">Subject</th>
              <th className="border px-4 py-2">Status</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((chapter) => (
              <tr key={chapter.id}>
                <td className="border px-4 py-2">{chapter.name}</td>
                <td className="border px-4 py-2">{chapter.slug}</td>
                <td className="border px-4 py-2">{chapter.subjectId}</td>
                <td className="border px-4 py-2"><StatusBadge status={chapter.status} /></td>
                <td className="border px-4 py-2">
                  <ModerationActions chapter={chapter} refresh={fetchChapters} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
