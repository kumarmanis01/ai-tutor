'use client';

/**
 * FILE OBJECTIVE:
 * - Admin page to view and approve/reject pending hydrated content (notes, tests).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/content-approval/page.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T04:15:00Z | copilot | Rewrote with real API integration for content approval
 */

import React, { useEffect, useState } from "react";

interface PendingItem {
  id: string;
  type: 'note' | 'test' | 'topic' | 'chapter';
  label: string;
  status: string;
  createdAt: string;
  details: {
    topicName?: string;
    chapterName?: string;
    board?: string;
    grade?: number;
    subject?: string;
    difficulty?: string;
    language?: string;
    questionCount?: number;
    version?: number;
  };
}

interface ContentSummary {
  totalPending: number;
  notes: number;
  tests: number;
}

type ActionState = {
  loading: boolean;
  error: string | null;
  action: 'approve' | 'reject' | null;
};

export default function AdminContentApprovalPage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [summary, setSummary] = useState<ContentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [filter, setFilter] = useState<'all' | 'note' | 'test'>('all');

  const fetchPendingContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/content-approval', {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('You do not have permission to access this page. Please ensure you are logged in as an admin.');
        }
        throw new Error(`Failed to fetch: ${res.status}`);
      }
      const data = await res.json();
      setItems(data.items || []);
      setSummary(data.summary || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingContent();
  }, []);

  const handleAction = async (item: PendingItem, action: 'approve' | 'reject') => {
    setActionStates((prev) => ({
      ...prev,
      [item.id]: { loading: true, error: null, action },
    }));

    try {
      const res = await fetch('/api/admin/content/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: item.type, id: item.id, action }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Action failed');
      }

      // Remove item from list on success
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSummary((prev) => prev ? {
        ...prev,
        totalPending: prev.totalPending - 1,
        [item.type === 'note' ? 'notes' : 'tests']: (prev[item.type === 'note' ? 'notes' : 'tests'] || 1) - 1,
      } : null);

      setActionStates((prev) => ({
        ...prev,
        [item.id]: { loading: false, error: null, action: null },
      }));
    } catch (err: unknown) {
      setActionStates((prev) => ({
        ...prev,
        [item.id]: { loading: false, error: err instanceof Error ? err.message : 'Action failed', action: null },
      }));
    }
  };

  const filteredItems = filter === 'all' ? items : items.filter((i) => i.type === filter);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Content Approval</h1>
        <button
          onClick={fetchPendingContent}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div className="text-3xl font-bold text-blue-600">{summary.totalPending}</div>
            <div className="text-sm text-gray-500">Total Pending</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div className="text-3xl font-bold text-green-600">{summary.notes}</div>
            <div className="text-sm text-gray-500">Notes</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div className="text-3xl font-bold text-purple-600">{summary.tests}</div>
            <div className="text-sm text-gray-500">Tests</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'note', 'test'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
            }`}
          >
            {f === 'all' ? 'All' : f === 'note' ? 'Notes' : 'Tests'}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-500">
          Loading pending content...
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredItems.length === 0 && (
        <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-4xl mb-2">✓</div>
          <p>No pending content to approve</p>
          <p className="text-sm mt-2">All hydrated content has been reviewed.</p>
        </div>
      )}

      {/* Content List */}
      <div className="space-y-4">
        {filteredItems.map((item) => {
          const state = actionStates[item.id] || { loading: false, error: null, action: null };
          return (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        item.type === 'note'
                          ? 'bg-green-100 text-green-800'
                          : item.type === 'test'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {item.type.toUpperCase()}
                    </span>
                    {item.details.difficulty && (
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">
                        {item.details.difficulty}
                      </span>
                    )}
                    {item.details.language && (
                      <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                        {item.details.language}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-lg">{item.label}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {item.details.board && `${item.details.board} • `}
                    {item.details.grade && `Grade ${item.details.grade} • `}
                    {item.details.subject}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {item.details.chapterName && `Chapter: ${item.details.chapterName}`}
                    {item.details.topicName && ` → Topic: ${item.details.topicName}`}
                  </div>
                  {item.details.questionCount !== undefined && (
                    <div className="text-sm text-gray-500 mt-1">
                      {item.details.questionCount} questions
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-2">
                    Created: {new Date(item.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleAction(item, 'approve')}
                    disabled={state.loading}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {state.loading && state.action === 'approve' ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleAction(item, 'reject')}
                    disabled={state.loading}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {state.loading && state.action === 'reject' ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              </div>
              {state.error && (
                <div className="mt-2 text-sm text-red-600">{state.error}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
