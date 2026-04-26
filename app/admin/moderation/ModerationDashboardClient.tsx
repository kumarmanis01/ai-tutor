/**
 * FILE OBJECTIVE:
 * - A1.1: ModerationDashboardClient -- client component that shows the V3
 *   content moderation table with filters, batch actions, and 30s polling.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/moderation/ModerationDashboardClient.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A1.1 ModerationDashboardClient component
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/logger';

type ModerationItem = {
  id: string;
  topic: string;
  subject: string;
  grade: number | null;
  board: string;
  language: string;
  type: string;
  status: string;
  version: number;
  requestCount: number;
  flagCount: number;
  jobStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ModerationResponse = {
  items: ModerationItem[];
  pagination: PaginationMeta;
};

type FilterState = {
  q: string;
  status: string;
  subject: string;
  grade: string;
  board: string;
  sort: string;
};

const POLL_INTERVAL_MS = 30_000;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_REVIEW: 'bg-[#FAEEDA] text-[#BA7517]',
  APPROVED: 'bg-[#EAF3DE] text-[#1D9E75]',
  REJECTED: 'bg-[#FCEBEB] text-[#E24B4A]',
  ARCHIVED: 'bg-gray-200 text-gray-500',
};

export function ModerationDashboardClient({ initialItems, initialTotal }: {
  initialItems: ModerationItem[];
  initialTotal: number;
}) {
  const [items, setItems] = useState<ModerationItem[]>(initialItems);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: initialTotal,
    totalPages: Math.ceil(initialTotal / 20),
  });
  const [filters, setFilters] = useState<FilterState>({
    q: '',
    status: '',
    subject: '',
    grade: '',
    board: '',
    sort: 'createdAt_desc',
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [batchPending, setBatchPending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildUrl = useCallback((page: number, f: FilterState) => {
    const p = new URLSearchParams({ page: String(page) });
    if (f.q) p.set('q', f.q);
    if (f.status) p.set('status', f.status);
    if (f.subject) p.set('subject', f.subject);
    if (f.grade) p.set('grade', f.grade);
    if (f.board) p.set('board', f.board);
    if (f.sort) p.set('sort', f.sort);
    return `/api/v1/admin/content/moderation?${p.toString()}`;
  }, []);

  const fetchPage = useCallback(async (page: number, f: FilterState, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch(buildUrl(page, f));
      const data = (await res.json()) as ModerationResponse;
      setItems(data.items ?? []);
      setPagination(data.pagination);
    } catch (err: unknown) {
      logger.error('ModerationDashboardClient: fetchPage failed', { error: err });
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [buildUrl]);

  // Initial load + polling
  useEffect(() => {
    void fetchPage(pagination.page, filters);
    pollRef.current = setInterval(() => {
      void fetchPage(pagination.page, filters, true);
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // Only re-run when filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function handleFilterChange(key: keyof FilterState, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSelected(new Set());
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(items.map((i) => i.id)));
    } else {
      setSelected(new Set());
    }
  }

  function handleSelectItem(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleBatchAction(action: 'approve' | 'reject' | 'archive') {
    if (selected.size === 0) return;
    setBatchPending(true);
    try {
      const res = await fetch('/api/v1/admin/content/moderation/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      if (res.ok) {
        setSuccessMsg(`${selected.size} item(s) ${action}d`);
        setSelected(new Set());
        setTimeout(() => setSuccessMsg(''), 3000);
        await fetchPage(pagination.page, filters);
      }
    } catch (err: unknown) {
      logger.error('ModerationDashboardClient: batch action failed', { action, error: err });
    } finally {
      setBatchPending(false);
    }
  }

  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-5">
        <input
          value={filters.q}
          onChange={(e) => handleFilterChange('q', e.target.value)}
          placeholder="Search topic..."
          className="min-h-[40px] rounded-lg border border-gray-200 px-3 text-sm focus:border-[#534AB7] focus:outline-none"
        />
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="min-h-[40px] rounded-lg border border-gray-200 px-3 text-sm focus:border-[#534AB7] focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <input
          value={filters.subject}
          onChange={(e) => handleFilterChange('subject', e.target.value)}
          placeholder="Subject..."
          className="min-h-[40px] rounded-lg border border-gray-200 px-3 text-sm focus:border-[#534AB7] focus:outline-none"
        />
        <input
          value={filters.grade}
          onChange={(e) => handleFilterChange('grade', e.target.value)}
          placeholder="Grade (e.g. 10)"
          type="number"
          min={1}
          max={12}
          className="min-h-[40px] rounded-lg border border-gray-200 px-3 text-sm focus:border-[#534AB7] focus:outline-none"
        />
        <select
          value={filters.sort}
          onChange={(e) => handleFilterChange('sort', e.target.value)}
          className="min-h-[40px] rounded-lg border border-gray-200 px-3 text-sm focus:border-[#534AB7] focus:outline-none"
        >
          <option value="createdAt_desc">Newest First</option>
          <option value="createdAt_asc">Oldest First</option>
          <option value="status_asc">Status</option>
          <option value="topic_asc">Topic A-Z</option>
        </select>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#EEEDFE] px-4 py-3">
          <span className="text-sm font-medium text-[#534AB7]">
            {selected.size} selected
          </span>
          <button
            type="button"
            disabled={batchPending}
            onClick={() => void handleBatchAction('approve')}
            className="min-h-[36px] rounded-lg bg-[#1D9E75] px-4 text-xs font-semibold text-white disabled:opacity-60 hover:bg-[#18876b]"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={batchPending}
            onClick={() => void handleBatchAction('reject')}
            className="min-h-[36px] rounded-lg bg-[#E24B4A] px-4 text-xs font-semibold text-white disabled:opacity-60 hover:bg-[#c43a39]"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={batchPending}
            onClick={() => void handleBatchAction('archive')}
            className="min-h-[36px] rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700 disabled:opacity-60"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-gray-500 hover:text-gray-700"
          >
            Clear selection
          </button>
        </div>
      )}

      {successMsg && (
        <div className="mb-3 rounded-xl bg-[#EAF3DE] px-4 py-2 text-sm font-medium text-[#1D9E75]">
          {successMsg}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label="Select all"
                  className="h-4 w-4 accent-[#534AB7]"
                />
              </th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700">Topic</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700">Subject</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-700">Grade</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700">Board</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-700">Requests</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-700">Flags</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-700">Status</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700">Date</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={idx} className="border-b border-gray-50">
                  <td colSpan={10} className="px-3 py-3">
                    <div className="h-6 w-full animate-pulse rounded bg-gray-100" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-sm text-gray-400">
                  No content items match the current filters.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const statusClass = STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600';
                const date = new Date(item.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: '2-digit',
                });
                return (
                  <tr
                    key={item.id}
                    className="border-b border-gray-50 transition hover:bg-gray-50"
                  >
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                        aria-label={`Select ${item.topic}`}
                        className="h-4 w-4 accent-[#534AB7]"
                      />
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 font-medium text-gray-800">
                      {item.topic}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{item.subject}</td>
                    <td className="px-3 py-3 text-center text-gray-600">{item.grade ?? '--'}</td>
                    <td className="px-3 py-3 text-gray-600">{item.board}</td>
                    <td className="px-3 py-3 text-center font-semibold text-[#534AB7]">
                      {item.requestCount}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {item.flagCount > 0 ? (
                        <span className="rounded-full bg-[#FCEBEB] px-2 text-xs font-semibold text-[#E24B4A]">
                          {item.flagCount}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">{date}</td>
                    <td className="px-3 py-3 text-center">
                      <Link
                        href={`/admin/moderation/${item.id}`}
                        className="min-h-[32px] inline-flex items-center justify-center rounded-lg border border-[#534AB7] px-3 text-xs font-semibold text-[#534AB7] hover:bg-[#EEEDFE]"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => void fetchPage(pagination.page - 1, filters)}
              className="min-h-[36px] rounded-lg border border-gray-300 px-3 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => void fetchPage(pagination.page + 1, filters)}
              className="min-h-[36px] rounded-lg border border-gray-300 px-3 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ModerationDashboardClient;
