'use client';

import { useEffect, useState, useCallback } from 'react';
import { ApprovalStatus } from '@/lib/ai-engine/types';

interface TopicRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  chapterId: string;
  chapter: { name: string };
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

function ModerationActions({ topic, refresh }: { topic: TopicRow; refresh: () => void }) {
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
      await fetch(`/api/admin/topics/${topic.id}/${action}`, {
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
    <div className="flex gap-2 flex-wrap">
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
      <button
        disabled={busy}
        className="min-h-[36px] px-2 py-1 text-xs text-blue-700 border border-blue-300 rounded disabled:opacity-50"
        onClick={() => handleAction('generate')}
      >
        {confirm === 'generate' ? 'Confirm?' : 'Regen'}
      </button>
      <button
        disabled={busy}
        className="min-h-[36px] px-2 py-1 text-xs text-gray-700 border border-gray-300 rounded disabled:opacity-50"
        onClick={() => handleAction('rollback')}
      >
        {confirm === 'rollback' ? 'Confirm?' : 'Unpublish'}
      </button>
    </div>
  );
}

export default function TopicsClient() {
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchTopics = useCallback(() => {
    setLoading(true);
    setError(false);
    const qs = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    fetch(`/api/admin/topics${qs}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data: TopicRow[]) => setTopics(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 bg-gray-200 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        {"Couldn't load topics -- tap to retry"}
        <button className="ml-3 underline text-sm" onClick={fetchTopics}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Topics</h1>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">{topics.length} topics</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <table className="min-w-full border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="border px-4 py-2 text-left">Name</th>
            <th className="border px-4 py-2 text-left">Slug</th>
            <th className="border px-4 py-2 text-left">Chapter</th>
            <th className="border px-4 py-2 text-left">Status</th>
            <th className="border px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {topics.length === 0 && (
            <tr>
              <td colSpan={5} className="border px-4 py-6 text-center text-gray-400">
                No topics found for this filter.
              </td>
            </tr>
          )}
          {topics.map((topic) => (
            <tr key={topic.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2 font-medium">{topic.name}</td>
              <td className="border px-4 py-2 text-gray-500 font-mono text-xs">{topic.slug}</td>
              <td className="border px-4 py-2">{topic.chapter?.name ?? topic.chapterId}</td>
              <td className="border px-4 py-2">
                <StatusBadge status={topic.status} />
              </td>
              <td className="border px-4 py-2">
                <ModerationActions topic={topic} refresh={fetchTopics} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
