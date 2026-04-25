'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { ApprovalStatus } from '@/lib/ai-engine/types';

interface ChapterRow {
  id: string;
  name: string;
  slug: string;
  subjectId: string;
  status: string;
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === ApprovalStatus.Approved
      ? 'bg-green-100 text-green-700'
      : status === ApprovalStatus.Rejected
        ? 'bg-red-100 text-red-700'
        : status === 'draft'
          ? 'bg-yellow-100 text-yellow-700'
          : 'bg-gray-100 text-gray-600';
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{status}</span>;
}

function ModerationActions({ chapter, refresh }: { chapter: ChapterRow; refresh: () => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAction = async (action: string) => {
    if (confirm !== action) {
      setConfirm(action);
      setTimeout(() => setConfirm(null), 2000);
      return;
    }
    setBusy(true);
    try {
      const body =
        action === 'reject' ? JSON.stringify({ reason: 'Rejected by admin' }) : undefined;
      await fetch(`/api/admin/chapters/${chapter.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      setConfirm(null);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        disabled={busy}
        className="min-h-[36px] px-2 py-1 text-xs text-green-700 border border-green-300 rounded disabled:opacity-50"
        onClick={() => handleAction('approve')}
      >
        {confirm === 'approve' ? 'Confirm?' : 'Approve'}
      </button>
      <button
        disabled={busy}
        className="min-h-[36px] px-2 py-1 text-xs text-red-700 border border-red-300 rounded disabled:opacity-50"
        onClick={() => handleAction('reject')}
      >
        {confirm === 'reject' ? 'Confirm?' : 'Reject'}
      </button>
    </div>
  );
}

export default function ChaptersClient() {
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchChapters = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch('/api/chapters')
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data: ChapterRow[]) => setChapters(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 bg-gray-200 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        {"Couldn't load chapters -- tap to retry"}
        <button className="ml-3 underline text-sm" onClick={fetchChapters}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Chapters</h1>
      <p className="text-sm text-gray-500 mb-4">{chapters.length} chapters</p>
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="border px-4 py-2 text-left">Name</th>
            <th className="border px-4 py-2 text-left">Slug</th>
            <th className="border px-4 py-2 text-left">Status</th>
            <th className="border px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {chapters.length === 0 && (
            <tr>
              <td colSpan={4} className="border px-4 py-4 text-center text-gray-400">
                No chapters found
              </td>
            </tr>
          )}
          {chapters.map((chapter) => (
            <tr key={chapter.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2 font-medium">{chapter.name}</td>
              <td className="border px-4 py-2 text-gray-500 font-mono text-xs">{chapter.slug}</td>
              <td className="border px-4 py-2">
                <StatusBadge status={chapter.status} />
              </td>
              <td className="border px-4 py-2">
                <ModerationActions chapter={chapter} refresh={fetchChapters} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
