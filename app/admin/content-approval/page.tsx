'use client';

/**
 * FILE OBJECTIVE:
 * - Unified admin page for reviewing and approving/rejecting ALL pending AI-generated content.
 * - Consolidated view for syllabus, chapters, topics, notes, and tests.
 * - Clickable content cards with detail modal for full content review before approval.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/content-approval/page.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-23T01:00:00Z | copilot | Consolidated moderation into unified Content Review page
 * - 2025-01-23T00:00:00Z | copilot | Added clickable content cards with detail panel for full content review
 * - 2026-01-22T04:15:00Z | copilot | Rewrote with real API integration for content approval
 * - 2026-01-22T06:55:00Z | copilot | Added support for all hydrated content types: syllabus, chapters, topics
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";

interface PendingItem {
  id: string;
  type: 'syllabus' | 'chapter' | 'topic' | 'note' | 'test';
  label: string;
  status: string;
  createdAt: string;
  details: {
    title?: string;
    topicName?: string;
    chapterName?: string;
    board?: string;
    grade?: number;
    subject?: string;
    difficulty?: string;
    language?: string;
    questionCount?: number;
    version?: number;
    order?: number;
  };
}

interface ContentDetail {
  id: string;
  type: string;
  title: string;
  content?: string;
  contentJson?: unknown;
  questions?: Array<{
    id: string;
    type: string;
    question: string;
    options?: string[];
    answer?: string | string[];
    marks?: number;
  }>;
  chapters?: Array<{ id: string; name: string; order: number }>;
  topics?: Array<{ id: string; name: string; order: number }>;
  metadata?: Record<string, unknown>;
}

interface ContentSummary {
  totalPending: number;
  syllabus: number;
  chapters: number;
  topics: number;
  notes: number;
  tests: number;
}

type FilterType = 'all' | 'syllabus' | 'chapter' | 'topic' | 'note' | 'test';

type ActionState = {
  loading: boolean;
  error: string | null;
  action: 'approve' | 'reject' | null;
};

// Content Detail Panel Component
function ContentDetailPanel({ 
  item, 
  onClose, 
  onAction 
}: { 
  item: PendingItem; 
  onClose: () => void;
  onAction: (item: PendingItem, action: 'approve' | 'reject') => Promise<void>;
}) {
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/content-approval/${item.type}/${item.id}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch detail: ${res.status}`);
        }
        const data = await res.json();
        setDetail(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [item.id, item.type]);

  const handleAction = async (action: 'approve' | 'reject') => {
    setActionLoading(action);
    try {
      await onAction(item, action);
      onClose();
    } catch {
      // Error handled in parent
    } finally {
      setActionLoading(null);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg">
          {error}
        </div>
      );
    }

    if (!detail) {
      return <div className="text-gray-500 text-center py-8">No content available</div>;
    }

    // Render based on content type
    switch (item.type) {
      case 'note':
        return (
          <div className="space-y-4">
            {detail.metadata && (
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {detail.metadata.topicName && <div><span className="font-medium">Topic:</span> {String(detail.metadata.topicName)}</div>}
                {detail.metadata.chapterName && <div><span className="font-medium">Chapter:</span> {String(detail.metadata.chapterName)}</div>}
                {(detail.metadata.subjectName || detail.metadata.subject) && <div><span className="font-medium">Subject:</span> {String(detail.metadata.subjectName || detail.metadata.subject)}</div>}
                {detail.metadata.language && <div><span className="font-medium">Language:</span> {String(detail.metadata.language)}</div>}
                {detail.metadata.version != null && <div><span className="font-medium">Version:</span> {String(detail.metadata.version)}</div>}
              </div>
            )}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Note Content</h4>
              {detail.contentJson ? (
                typeof detail.contentJson === 'string' ? (
                  <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: detail.contentJson }} />
                ) : (detail.contentJson as any).sections ? (
                  <div className="space-y-4">
                    {((detail.contentJson as any).sections as Array<{heading: string; content: string}>).map((s, i) => (
                      <div key={i}>
                        <h5 className="font-semibold text-base mb-1">{s.heading}</h5>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{s.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="text-sm bg-white dark:bg-gray-900 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(detail.contentJson, null, 2)}
                  </pre>
                )
              ) : detail.content ? (
                <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                  {detail.content}
                </div>
              ) : (
                <p className="text-gray-500">No content found</p>
              )}
            </div>
          </div>
        );

      case 'test':
        return (
          <div className="space-y-4">
            <div className="font-semibold">Questions ({detail.questions?.length || 0})</div>
            {detail.questions?.map((q, idx) => (
              <div key={q.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center font-semibold text-sm">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                        {q.type}
                      </span>
                      {q.marks && (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">
                          {q.marks} marks
                        </span>
                      )}
                    </div>
                    <p className="font-medium mb-3">{q.question}</p>
                    {q.options && typeof q.options === 'object' && !Array.isArray(q.options) ? (
                      <div className="space-y-2 mb-3">
                        {Object.entries(q.options).map(([key, val]) => (
                          <div
                            key={key}
                            className={`p-2 rounded border ${
                              (q.answer as any)?.correct === key
                                ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <span className="font-medium mr-2">{key}.</span>
                            {String(val)}
                          </div>
                        ))}
                      </div>
                    ) : q.options && Array.isArray(q.options) ? (
                      <div className="space-y-2 mb-3">
                        {q.options.map((opt, i) => (
                          <div
                            key={i}
                            className={`p-2 rounded border ${
                              (Array.isArray(q.answer) ? q.answer.includes(opt) : q.answer === opt)
                                ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                            {opt}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Answer:</span>{' '}
                      {typeof q.answer === 'object' && q.answer !== null && 'correct' in (q.answer as any)
                        ? `${(q.answer as any).correct}${(q.answer as any).explanation ? ` — ${(q.answer as any).explanation}` : ''}`
                        : Array.isArray(q.answer) ? q.answer.join(', ') : String(q.answer)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'syllabus':
        return (
          <div className="space-y-4">
            <div className="font-semibold">Chapters ({detail.chapters?.length || 0})</div>
            {detail.chapters?.map((ch) => (
              <div key={ch.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg flex items-center gap-3">
                <span className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded flex items-center justify-center font-semibold text-sm">
                  {ch.order}
                </span>
                <span>{ch.name}</span>
              </div>
            ))}
          </div>
        );

      case 'chapter':
        return (
          <div className="space-y-4">
            <div className="font-semibold">Topics ({detail.topics?.length || 0})</div>
            {detail.topics?.map((t) => (
              <div key={t.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg flex items-center gap-3">
                <span className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 rounded flex items-center justify-center font-semibold text-sm">
                  {t.order}
                </span>
                <span>{t.name}</span>
              </div>
            ))}
          </div>
        );

      case 'topic':
        return (
          <div className="space-y-4">
            {detail.metadata && (
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                {detail.metadata.chapterName && <div><span className="font-medium">Chapter:</span> {String(detail.metadata.chapterName)}</div>}
                {(detail.metadata.subjectName || detail.metadata.subject) && <div><span className="font-medium">Subject:</span> {String(detail.metadata.subjectName || detail.metadata.subject)}</div>}
                {detail.metadata.order != null && <div><span className="font-medium">Order:</span> {String(detail.metadata.order)}</div>}
              </div>
            )}
            <div className="flex gap-4 text-sm">
              <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded">
                <span className="font-semibold text-blue-700 dark:text-blue-300">{(detail.metadata as any)?.noteCount ?? 0}</span> Notes
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/30 px-3 py-2 rounded">
                <span className="font-semibold text-purple-700 dark:text-purple-300">{(detail.metadata as any)?.testCount ?? 0}</span> Tests
              </div>
            </div>
            {(detail.metadata as any)?.notes?.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Notes</h4>
                <ul className="space-y-1">
                  {((detail.metadata as any).notes as Array<{id: string; language: string; version: number; status: string}>).map((n) => (
                    <li key={n.id} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded flex justify-between">
                      <span>{n.language} (v{n.version})</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${n.status === 'approved' ? 'bg-green-100 text-green-800' : n.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>{n.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(detail.metadata as any)?.tests?.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Tests</h4>
                <ul className="space-y-1">
                  {((detail.metadata as any).tests as Array<{id: string; difficulty: string; language: string; status: string}>).map((t) => (
                    <li key={t.id} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded flex justify-between">
                      <span>{t.difficulty} / {t.language}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${t.status === 'approved' ? 'bg-green-100 text-green-800' : t.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>{t.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(detail, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2 py-1 text-xs font-semibold rounded ${
                  item.type === 'syllabus'
                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                    : item.type === 'chapter'
                    ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
                    : item.type === 'topic'
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                    : item.type === 'note'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                }`}
              >
                {item.type.toUpperCase()}
              </span>
              {item.details.difficulty && (
                <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  {item.details.difficulty}
                </span>
              )}
              {item.details.language && (
                <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {item.details.language}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{item.label}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {item.details.board && `${item.details.board} • `}
              {item.details.grade && `Grade ${item.details.grade} • `}
              {item.details.subject}
            </p>
            {item.details.chapterName && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Chapter: {item.details.chapterName}
                {item.details.topicName && ` → Topic: ${item.details.topicName}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>

        {/* Footer with actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Created: {new Date(item.createdAt).toLocaleString()}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={() => handleAction('reject')}
              disabled={actionLoading !== null}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading === 'reject' && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Reject
            </button>
            <button
              onClick={() => handleAction('approve')}
              disabled={actionLoading !== null}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading === 'approve' && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminContentApprovalPage() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  
  const [items, setItems] = useState<PendingItem[]>([]);
  const [summary, setSummary] = useState<ContentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const fetchPendingContent = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchPendingContent();
  }, [fetchPendingContent]);

  // Poll the admin jobs/status endpoint periodically and refresh pending content
  // when a linked HydrationJob reports contentReady or a job completed.
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/jobs/status', { credentials: 'include' });
        if (!res.ok) return;
        const d = await res.json();
        const shouldRefresh = Array.isArray(d.jobs) && d.jobs.some((j: any) => j.contentReady === true || j.latestLog?.event === 'COMPLETED');
        const now = Date.now();
        // Apply a short cooldown to avoid repeated refreshes when jobs transition quickly.
        if (shouldRefresh && now - (lastRefreshRef.current || 0) > 10000) {
          lastRefreshRef.current = now;
          fetchPendingContent();
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [fetchPendingContent]);

  const handleAction = useCallback(async (item: PendingItem, action: 'approve' | 'reject') => {
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
      setSummary((prev) => {
        if (!prev) return null;
        const typeKey = item.type === 'note' ? 'notes' 
          : item.type === 'test' ? 'tests' 
          : item.type === 'chapter' ? 'chapters'
          : item.type === 'topic' ? 'topics'
          : 'syllabus';
        return {
          ...prev,
          totalPending: prev.totalPending - 1,
          [typeKey]: Math.max(0, (prev[typeKey] || 1) - 1),
        };
      });

      setActionStates((prev) => ({
        ...prev,
        [item.id]: { loading: false, error: null, action: null },
      }));
    } catch (err: unknown) {
      setActionStates((prev) => ({
        ...prev,
        [item.id]: { loading: false, error: err instanceof Error ? err.message : 'Action failed', action: null },
      }));
      throw err; // Re-throw to let modal handle it
    }
  }, []);

  const filteredItems = filter === 'all' ? items : items.filter((i) => i.type === filter);

  // Type icons and colors
  const typeConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
    syllabus: {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/50',
    },
    chapter: {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/50',
    },
    topic: {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/50',
    },
    note: {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/50',
    },
    test: {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/50',
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Review</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Review and approve AI-generated content before publishing</p>
              </div>
            </div>
            <button
              onClick={fetchPendingContent}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalPending}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Pending</p>
                </div>
              </div>
            </div>
            {(['syllabus', 'chapters', 'topics', 'notes', 'tests'] as const).map((key) => {
              const typeKey = key === 'chapters' ? 'chapter' : key === 'topics' ? 'topic' : key === 'notes' ? 'note' : key === 'tests' ? 'test' : 'syllabus';
              const config = typeConfig[typeKey];
              return (
                <div key={key} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${config.bgColor} rounded-lg flex items-center justify-center ${config.color}`}>
                      {config.icon}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary[key]}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{key}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-1 mb-6 inline-flex">
          {([
            { key: 'all', label: 'All', count: items.length },
            { key: 'syllabus', label: 'Syllabus', count: items.filter(i => i.type === 'syllabus').length },
            { key: 'chapter', label: 'Chapters', count: items.filter(i => i.type === 'chapter').length },
            { key: 'topic', label: 'Topics', count: items.filter(i => i.type === 'topic').length },
            { key: 'note', label: 'Notes', count: items.filter(i => i.type === 'note').length },
            { key: 'test', label: 'Tests', count: items.filter(i => i.type === 'test').length },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                  filter === key ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-red-800 dark:text-red-300">Error loading content</p>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2" />
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredItems.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">All Caught Up!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === 'all' 
                ? 'No content pending review. All AI-generated content has been reviewed.' 
                : `No ${filter}s pending review.`}
            </p>
          </div>
        )}

        {/* Content List */}
        {!loading && filteredItems.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredItems.map((item) => {
                const state = actionStates[item.id] || { loading: false, error: null, action: null };
                const config = typeConfig[item.type];
                return (
                  <div
                    key={item.id}
                    className="p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Type Icon */}
                      <div className={`w-12 h-12 ${config.bgColor} rounded-xl flex items-center justify-center ${config.color} flex-shrink-0`}>
                        {config.icon}
                      </div>

                      {/* Content Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded ${config.bgColor} ${config.color}`}>
                            {item.type.toUpperCase()}
                          </span>
                          {item.details.difficulty && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400">
                              {item.details.difficulty}
                            </span>
                          )}
                          {item.details.language && (
                            <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
                              {item.details.language}
                            </span>
                          )}
                          {item.details.questionCount !== undefined && (
                            <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400">
                              {item.details.questionCount} questions
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {item.label.replace(/^(Syllabus|Chapter|Topic|Note|Test): /, '')}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.details.board && `${item.details.board} • `}
                          {item.details.grade && `Grade ${item.details.grade} • `}
                          {item.details.subject}
                        </p>
                        {(item.details.chapterName || item.details.topicName) && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {item.details.chapterName && `Chapter: ${item.details.chapterName}`}
                            {item.details.topicName && ` → ${item.details.topicName}`}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleAction(item, 'reject')}
                          disabled={state.loading}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                          title="Reject"
                        >
                          {state.loading && state.action === 'reject' ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleAction(item, 'approve')}
                          disabled={state.loading}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50"
                          title="Approve"
                        >
                          {state.loading && state.action === 'approve' ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Chevron */}
                      <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    {state.error && (
                      <div className="mt-2 ml-16 text-sm text-red-600 dark:text-red-400">{state.error}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {selectedItem && (
          <ContentDetailPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onAction={handleAction}
          />
        )}
      </div>
    </div>
  );
}
