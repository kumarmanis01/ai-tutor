'use client';

import React, { useState, useTransition, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyllabusItemType = 'chapter' | 'topic' | 'note' | 'test';

export interface SyllabusItem {
  id: string;
  type: SyllabusItemType;
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
// Constants
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<SyllabusItemType, string> = {
  chapter: 'Chapter', topic: 'Topic', note: 'Note', test: 'Test',
};

const TYPE_COLORS: Record<SyllabusItemType, string> = {
  chapter: 'bg-[#E6F1FB] text-[#0C447C]',
  topic: 'bg-[#FAEEDA] text-[#633806]',
  note: 'bg-[#EAF3DE] text-[#27500A]',
  test: 'bg-[#EEEDFE] text-[#3C3489]',
};

const FLAG_REASONS = [
  'Inaccurate Content',
  'Inappropriate',
  'Duplicate',
  'Poor Quality',
  'Needs Revision',
  'Other',
] as const;

// ---------------------------------------------------------------------------
// Preview modal (reused from ContentReviewTable)
// ---------------------------------------------------------------------------

type PreviewState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'loaded'; data: Record<string, unknown> }
  | { phase: 'error'; message: string };

function NoteContentBlock({ contentJson }: { contentJson: unknown }) {
  if (!contentJson || typeof contentJson !== 'object') {
    return <p className="text-[11px] text-gray-500 italic">No content</p>;
  }
  const obj = contentJson as Record<string, unknown>;
  const sections = obj.sections as Array<Record<string, unknown>> | undefined;
  if (sections && Array.isArray(sections)) {
    return (
      <div className="space-y-3">
        {sections.map((s, i) => {
          const title = (s && (s.heading ?? s.title ?? s.type)) as string | undefined;
          const body = (s && (s.body ?? s.content ?? s.text ?? s.explanation)) as string | undefined;
          const blackboard = (s && (s.blackboardNotes ?? s.blackboard ?? s.notes)) as string[] | undefined;
          return (
            <div key={i}>
              {title && <p className="text-[11px] font-semibold text-gray-700">{String(title)}</p>}
              {body && <p className="text-[11px] text-gray-600 whitespace-pre-wrap">{String(body)}</p>}
              {Array.isArray(blackboard) && blackboard.length > 0 && (
                <ul className="mt-1 ml-3 list-disc list-inside text-[11px] text-gray-600">
                  {blackboard.map((b, bi) => <li key={bi}>{String(b)}</li>)}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <pre className="text-[10px] text-gray-500 whitespace-pre-wrap bg-gray-50 rounded p-2 max-h-48 overflow-y-auto">
      {JSON.stringify(contentJson, null, 2)}
    </pre>
  );
}

function PreviewModal({ state, onClose }: { state: PreviewState; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (state.phase === 'idle') return null;
  const data = state.phase === 'loaded' ? state.data : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">
            Content Preview
            {data && <span className="ml-2 text-[10px] font-normal text-gray-400 capitalize">({String(data.type)})</span>}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded min-h-[32px] min-w-[32px] flex items-center justify-center">
            &times;
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {state.phase === 'loading' && <p className="text-[12px] text-gray-500 py-8 text-center">Loading content...</p>}
          {state.phase === 'error' && <p className="text-[12px] text-[#E24B4A] py-8 text-center">{state.message} -- please try again.</p>}
          {data && (
            <>
              <div>
                <p className="text-[10px] text-gray-400">{[data.subject, data.chapter, data.topic].filter(Boolean).join(' / ')}</p>
                <p className="text-[10px] text-gray-400">
                  {String(data.board ?? '')} &middot; Grade {String(data.grade ?? '')}
                  {data.language ? ` · ${String(data.language).toUpperCase()}` : ''}
                  {data.difficulty ? ` · ${String(data.difficulty)}` : ''}
                </p>
              </div>
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">{String(data.title ?? '')}</h3>
              {data.type === 'note' && <div><p className="text-[11px] font-medium text-gray-600 mb-1.5">Content</p><NoteContentBlock contentJson={data.contentJson} /></div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flag modal
// ---------------------------------------------------------------------------

function FlagModal({
  item,
  onFlag,
  onClose,
  busy,
}: {
  item: SyllabusItem;
  onFlag: (reason: string) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [reason, setReason] = useState<string>(FLAG_REASONS[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Flag for review</h2>
        <p className="text-[11px] text-gray-500">
          {item.topicName ?? item.chapterName ?? item.id}
        </p>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
          >
            {FLAG_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl min-h-[36px] transition-colors">
            Cancel
          </button>
          <button onClick={() => onFlag(reason)} disabled={busy} className="px-4 py-2 text-[12px] bg-[#BA7517] text-white rounded-xl min-h-[36px] hover:bg-[#9a6014] disabled:opacity-50 transition-colors">
            {busy ? 'Flagging...' : 'Flag'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single row
// ---------------------------------------------------------------------------

function SyllabusRow({
  item,
  onRefresh,
  onPreview,
  onFlagged,
}: {
  item: SyllabusItem;
  onRefresh: () => void;
  onPreview: (id: string, type: SyllabusItemType) => void;
  onFlagged: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flagModal, setFlagModal] = useState(false);
  const [flagged, setFlagged] = useState(false);

  async function act(action: 'approve' | 'reject') {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/content/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, type: item.type, action }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? 'Request failed');
      }
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function handleFlag(reason: string) {
    setBusy(true);
    try {
      await fetch('/api/admin/content/flag-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, type: item.type, reason }),
      });
      setFlagged(true);
      onFlagged(item.id);
    } catch {
      setErr('Flag failed');
    } finally {
      setBusy(false);
      setFlagModal(false);
    }
  }

  const breadcrumb = [item.subjectName, item.chapterName, item.topicName].filter(Boolean).join(' / ');

  return (
    <>
      {flagModal && (
        <FlagModal item={item} onFlag={handleFlag} onClose={() => setFlagModal(false)} busy={busy} />
      )}
      <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 last:border-0">
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLORS[item.type]}`}>
              {TYPE_LABELS[item.type]}
            </span>
            {flagged && (
              <span className="inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FAEEDA] text-[#BA7517]">
                Flagged
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <p className="text-[11px] text-gray-700 dark:text-gray-300 max-w-[180px] truncate" title={breadcrumb}>
            {breadcrumb}
          </p>
          <p className="text-[10px] text-gray-400">
            {item.boardName} &middot; Grade {item.grade}
            {item.language && ` · ${item.language.toUpperCase()}`}
            {item.difficulty && ` · ${item.difficulty}`}
          </p>
        </td>
        <td className="px-3 py-2.5 max-w-[240px]">
          <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate" title={item.preview}>
            {item.preview || <em className="text-gray-400">No preview</em>}
          </p>
        </td>
        <td className="px-3 py-2.5 text-[10px] text-gray-400 whitespace-nowrap">
          {new Date(item.createdAt).toLocaleDateString()}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
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
            <button
              onClick={() => setFlagModal(true)}
              disabled={busy || flagged}
              className="inline-flex text-[10px] px-2 py-1 rounded border border-[#FAEEDA] bg-[#FAEEDA] text-[#BA7517] hover:bg-[#f5e0c4] disabled:opacity-50 min-h-[28px] transition-colors"
            >
              Flag
            </button>
          </div>
        </td>
      </tr>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main tab component
// ---------------------------------------------------------------------------

export function SyllabusContentTab({ items: initialItems }: { items: SyllabusItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [typeFilter, setTypeFilter] = useState<SyllabusItemType | 'all'>('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>({ phase: 'idle' });
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  function refresh() {
    startTransition(() => router.refresh());
  }

  const openPreview = useCallback(async (id: string, type: SyllabusItemType) => {
    setPreviewState({ phase: 'loading' });
    try {
      const r = await fetch(`/api/admin/content-approval/preview?type=${type}&id=${id}`);
      const data = await r.json() as Record<string, unknown>;
      if (!r.ok) throw new Error((data.error as string | undefined) ?? 'Failed');
      setPreviewState({ phase: 'loaded', data });
    } catch (e) {
      setPreviewState({ phase: 'error', message: e instanceof Error ? e.message : 'Error' });
    }
  }, []);

  const closePreview = useCallback(() => setPreviewState({ phase: 'idle' }), []);

  const subjects = [...new Set(initialItems.map((i) => i.subjectName))].sort();

  const visible = initialItems.filter((i) => {
    if (typeFilter !== 'all' && i.type !== typeFilter) return false;
    if (subjectFilter !== 'all' && i.subjectName !== subjectFilter) return false;
    return true;
  });

  async function bulkApprove() {
    setBulkBusy(true);
    try {
      await Promise.all(
        visible.map((i) =>
          fetch('/api/admin/content/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: i.id, type: i.type, action: 'approve' }),
          })
        )
      );
      refresh();
    } catch {
      // individual row errors will surface on refresh
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <>
      <PreviewModal state={previewState} onClose={closePreview} />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as SyllabusItemType | 'all')}
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
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-[11px] text-gray-400 ml-1">{visible.length} item{visible.length === 1 ? '' : 's'}</span>
          {flaggedIds.size > 0 && (
            <span className="text-[11px] text-[#BA7517] ml-1">{flaggedIds.size} flagged</span>
          )}
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

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          {visible.length === 0 ? (
            <p className="text-[12px] text-gray-400 py-10 text-center">No items pending review</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    {['Type', 'Subject / Chapter', 'Preview', 'Created', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <SyllabusRow
                      key={item.id}
                      item={item}
                      onRefresh={refresh}
                      onPreview={openPreview}
                      onFlagged={(id) => setFlaggedIds((prev) => new Set([...prev, id]))}
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
