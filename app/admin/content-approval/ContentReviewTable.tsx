'use client';

import React, { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types (shared with page.tsx)
// ---------------------------------------------------------------------------

export type ReviewItemType = 'chapter' | 'topic' | 'note' | 'test';

export interface ReviewItemData {
  id: string;
  type: ReviewItemType;
  subjectName: string;
  boardName: string;
  grade: number;
  chapterName: string | null;
  topicName: string | null;
  preview: string;
  language: string | null;
  difficulty: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Preview modal
// ---------------------------------------------------------------------------

type PreviewState =
  | { phase: 'idle' }
  | { phase: 'loading'; id: string; type: ReviewItemType }
  | { phase: 'loaded'; data: Record<string, unknown> }
  | { phase: 'error'; message: string };

function NoteContentBlock({ contentJson }: { contentJson: unknown }) {
  if (!contentJson || typeof contentJson !== 'object') {
    return <p className="text-[11px] text-gray-500 italic">No content</p>;
  }
  const obj = contentJson as Record<string, unknown>;
  // Render top-level sections. Support both legacy shape (heading/body)
  // and VidyaNotesSchema shape (title/content/blackboardNotes).
  const sections = obj.sections as Array<Record<string, unknown>> | undefined;
  if (sections && Array.isArray(sections)) {
    return (
      <div className="space-y-3">
        {sections.map((s, i) => {
          const title = (s && (s.heading ?? s.title ?? s.type)) as string | undefined;
          const body = (s && (s.body ?? s.content ?? s.text ?? s.explanation)) as
            | string
            | undefined;
          const blackboard = (s && (s.blackboardNotes ?? s.blackboard ?? s.notes)) as
            | string[]
            | undefined;

          return (
            <div key={i}>
              {title && <p className="text-[11px] font-semibold text-gray-700">{String(title)}</p>}
              {body && (
                <p className="text-[11px] text-gray-600 whitespace-pre-wrap">{String(body)}</p>
              )}
              {Array.isArray(blackboard) && blackboard.length > 0 && (
                <ul className="mt-1 ml-3 list-disc list-inside text-[11px] text-gray-600">
                  {blackboard.map((b, bi) => (
                    <li key={bi}>{String(b)}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  // Fallback: render raw JSON
  return (
    <pre className="text-[10px] text-gray-500 whitespace-pre-wrap bg-gray-50 rounded p-2 max-h-48 overflow-y-auto">
      {JSON.stringify(contentJson, null, 2)}
    </pre>
  );
}

function PreviewModal({ state, onClose }: { state: PreviewState; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (state.phase === 'idle') return null;

  const data = state.phase === 'loaded' ? state.data : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">
            Content Preview
            {data && (
              <span className="ml-2 text-[10px] font-normal text-gray-400 capitalize">
                ({String(data.type)})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label="Close preview"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {state.phase === 'loading' && (
            <p className="text-[12px] text-gray-500 py-8 text-center">Loading content...</p>
          )}
          {state.phase === 'error' && (
            <p className="text-[12px] text-[#E24B4A] py-8 text-center">
              {state.message} -- please try again.
            </p>
          )}

          {data && (
            <>
              {/* Breadcrumb */}
              <div>
                <p className="text-[10px] text-gray-400">
                  {[data.subject, data.chapter, data.topic].filter(Boolean).join(' / ')}
                </p>
                <p className="text-[10px] text-gray-400">
                  {String(data.board ?? '')} &middot; Grade {String(data.grade ?? '')}
                  {data.language ? ` \u00b7 ${String(data.language).toUpperCase()}` : ''}
                  {data.difficulty ? ` \u00b7 ${String(data.difficulty)}` : ''}
                </p>
              </div>

              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
                {String(data.title ?? '')}
              </h3>

              {/* Chapter topics list */}
              {data.type === 'chapter' && Array.isArray(data.topics) && (
                <div>
                  <p className="text-[11px] font-medium text-gray-600 mb-1.5">
                    Topics ({(data.topics as unknown[]).length})
                  </p>
                  <ul className="space-y-1">
                    {(data.topics as Array<{ name: string; status: string }>).map((t, i) => (
                      <li key={i} className="flex items-center gap-2 text-[11px] text-gray-700">
                        <span className="w-4 text-gray-400">{i + 1}.</span>
                        <span className="flex-1">{t.name}</span>
                        <span className="text-[9px] text-gray-400 capitalize">{t.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Topic notes list */}
              {data.type === 'topic' && Array.isArray(data.notes) && (
                <div>
                  <p className="text-[11px] font-medium text-gray-600 mb-1.5">
                    Notes ({(data.notes as unknown[]).length})
                  </p>
                  {(data.notes as Array<{ title: string; language: string; status: string }>)
                    .length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic">No notes generated yet</p>
                  ) : (
                    <ul className="space-y-1">
                      {(
                        data.notes as Array<{ title: string; language: string; status: string }>
                      ).map((n, i) => (
                        <li key={i} className="flex items-center gap-2 text-[11px] text-gray-700">
                          <span className="flex-1">{n.title}</span>
                          <span className="text-[9px] text-gray-400 uppercase">{n.language}</span>
                          <span className="text-[9px] text-gray-400 capitalize">{n.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Note content */}
              {data.type === 'note' && (
                <div>
                  <p className="text-[11px] font-medium text-gray-600 mb-1.5">Content</p>
                  <NoteContentBlock contentJson={data.contentJson} />
                </div>
              )}

              {/* Test questions */}
              {data.type === 'test' && Array.isArray(data.questions) && (
                <div>
                  <p className="text-[11px] font-medium text-gray-600 mb-2">
                    Questions ({(data.questions as unknown[]).length})
                  </p>
                  <ol className="space-y-4">
                    {(
                      data.questions as Array<{
                        type: string;
                        question: string;
                        options: unknown;
                        answer: string;
                        explanation: string | null;
                      }>
                    ).map((q, i) => (
                      <li key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                        <p className="text-[11px] font-medium text-gray-700">
                          {i + 1}. {q.question}
                        </p>
                        {q.options && Array.isArray(q.options) && (
                          <ul className="space-y-0.5 pl-3">
                            {(q.options as string[]).map((opt, oi) => (
                              <li key={oi} className="text-[10px] text-gray-600">
                                {String.fromCharCode(65 + oi)}. {opt}
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-[10px] text-[#1D9E75] font-medium">Answer: {q.answer}</p>
                        {q.explanation && (
                          <p className="text-[10px] text-gray-500 italic">{q.explanation}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<ReviewItemType, string> = {
  chapter: 'Chapter',
  topic: 'Topic',
  note: 'Note',
  test: 'Test',
};

const TYPE_COLORS: Record<ReviewItemType, string> = {
  chapter: 'bg-[#E6F1FB] text-[#0C447C]',
  topic: 'bg-[#FAEEDA] text-[#633806]',
  note: 'bg-[#EAF3DE] text-[#27500A]',
  test: 'bg-[#EEEDFE] text-[#3C3489]',
};

// ---------------------------------------------------------------------------
// Action handler
// ---------------------------------------------------------------------------

async function approveItem(id: string, type: ReviewItemType, action: 'approve' | 'reject') {
  const r = await fetch('/api/admin/content/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, type, action }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error ?? 'Request failed');
  }
}

// ---------------------------------------------------------------------------
// Single row
// ---------------------------------------------------------------------------

function ReviewRow({
  item,
  onRefresh,
  onPreview,
}: {
  item: ReviewItemData;
  onRefresh: () => void;
  onPreview: (id: string, type: ReviewItemType) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: 'approve' | 'reject') {
    setBusy(true);
    setErr(null);
    try {
      await approveItem(item.id, item.type, action);
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  const breadcrumb = [item.subjectName, item.chapterName, item.topicName]
    .filter(Boolean)
    .join(' / ');

  return (
    <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLORS[item.type]}`}
        >
          {TYPE_LABELS[item.type]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <p
          className="text-[11px] text-gray-700 dark:text-gray-300 max-w-[180px] truncate"
          title={breadcrumb}
        >
          {breadcrumb}
        </p>
        <p className="text-[10px] text-gray-400">
          {item.boardName} &middot; Grade {item.grade}
          {item.language && ` \u00b7 ${item.language.toUpperCase()}`}
          {item.difficulty && ` \u00b7 ${item.difficulty}`}
        </p>
      </td>
      <td className="px-3 py-2.5 max-w-[260px]">
        <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate" title={item.preview}>
          {item.preview || <em className="text-gray-400">No preview</em>}
        </p>
      </td>
      <td className="px-3 py-2.5 text-[10px] text-gray-400 whitespace-nowrap">
        {new Date(item.createdAt).toLocaleDateString()}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {err && <span className="text-[9px] text-[#E24B4A]">{err}</span>}
          <button
            onClick={() => onPreview(item.id, item.type)}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 min-h-[28px] transition-colors"
          >
            Preview
          </button>
          <button
            onClick={() => act('approve')}
            disabled={busy}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-[#c8e6c9] bg-[#EAF3DE] text-[#27500A] hover:bg-[#d9edd9] disabled:opacity-50 min-h-[28px] transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => act('reject')}
            disabled={busy}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-[#f9d7d7] bg-[#FCEBEB] text-[#791F1F] hover:bg-[#f9d7d7] disabled:opacity-50 min-h-[28px] transition-colors"
          >
            Reject
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Table with filters + bulk approve
// ---------------------------------------------------------------------------

export function ContentReviewTable({ items }: { items: ReviewItemData[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [typeFilter, setTypeFilter] = useState<ReviewItemType | 'all'>('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>({ phase: 'idle' });

  function refresh() {
    startTransition(() => router.refresh());
  }

  const openPreview = useCallback(async (id: string, type: ReviewItemType) => {
    setPreviewState({ phase: 'loading', id, type });
    try {
      const r = await fetch(`/api/admin/content-approval/preview?type=${type}&id=${id}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Failed');
      setPreviewState({ phase: 'loaded', data });
    } catch (e) {
      setPreviewState({ phase: 'error', message: e instanceof Error ? e.message : 'Error' });
    }
  }, []);

  const closePreview = useCallback(() => setPreviewState({ phase: 'idle' }), []);

  const subjects = [...new Set(items.map((i) => i.subjectName))].sort();

  const visible = items.filter((i) => {
    if (typeFilter !== 'all' && i.type !== typeFilter) return false;
    if (subjectFilter !== 'all' && i.subjectName !== subjectFilter) return false;
    return true;
  });

  async function bulkApprove() {
    setBulkBusy(true);
    try {
      await Promise.all(visible.map((i) => approveItem(i.id, i.type, 'approve')));
      refresh();
    } catch {
      // individual row errors surface per-row on refresh
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <>
      <PreviewModal state={previewState} onClose={closePreview} />
      <div className="space-y-3">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ReviewItemType | 'all')}
            className="text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
          >
            <option value="all">All types</option>
            <option value="chapter">Chapters</option>
            <option value="topic">Topics</option>
            <option value="note">Notes</option>
            <option value="test">Tests</option>
          </select>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
          >
            <option value="all">All subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <span className="text-[11px] text-gray-400 ml-1">
            {visible.length} item{visible.length === 1 ? '' : 's'}
          </span>

          <div className="ml-auto">
            {visible.length > 0 && (
              <button
                onClick={bulkApprove}
                disabled={bulkBusy}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-[#EAF3DE] text-[#27500A] border border-[#c8e6c9] hover:bg-[#d9edd9] disabled:opacity-50 min-h-[32px] transition-colors"
              >
                {bulkBusy ? 'Approving...' : `Approve all ${visible.length}`}
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          {visible.length === 0 ? (
            <p className="text-[12px] text-gray-400 py-10 text-center">No items pending review</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    {['Type', 'Subject / Chapter', 'Preview', 'Created', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <ReviewRow
                      key={item.id}
                      item={item}
                      onRefresh={refresh}
                      onPreview={openPreview}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
