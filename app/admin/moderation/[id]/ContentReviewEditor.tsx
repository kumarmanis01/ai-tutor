/**
 * FILE OBJECTIVE:
 * - A1.2: ContentReviewEditor -- side-by-side markdown editor + preview for
 *   admin content review. 70% preview / 30% editor layout. Version history
 *   tab, sticky action bar (Approve/Reject/Request Revision/Save Draft).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/moderation/[id]/ContentReviewEditor.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A1.2 ContentReviewEditor component
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type ContentVersion = {
  id: string;
  version: number;
  contentJson: unknown;
  createdAt: string;
};

type ContentFlag = {
  id: string;
  reason: string;
  notes: string | null;
  flaggedBy: string | null;
  createdAt: string;
};

type ContentItem = {
  id: string;
  topic: string;
  subject: string;
  grade: number | null;
  board: string;
  language: string;
  type: string;
  status: string;
  version: number;
  contentJson: unknown;
  createdAt: string;
  updatedAt: string;
  versions: ContentVersion[];
  flags: ContentFlag[];
};

type ActiveTab = 'editor' | 'history' | 'flags';

type RejectModalState = {
  open: boolean;
  reason: string;
};

function renderWithLatex(text: string): string {
  // Render display math $$...$$ then inline math $...$
  let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr: string) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span class="text-[#E24B4A]">$$${expr}$$</span>`;
    }
  });
  result = result.replace(/\$([^$\n]+?)\$/g, (_, expr: string) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="text-[#E24B4A]">$${expr}$</span>`;
    }
  });
  return result;
}

function renderContentPreview(contentJson: unknown): string {
  if (!contentJson || typeof contentJson !== 'object') return '';
  const obj = contentJson as Record<string, unknown>;

  // Handle the standard AI content format
  const sections = obj.sections ?? obj.blocks ?? obj.content;
  if (Array.isArray(sections)) {
    return sections
      .map((s: unknown) => {
        if (!s || typeof s !== 'object') return '';
        const sec = s as Record<string, unknown>;
        const title = typeof sec.title === 'string' ? `## ${sec.title}\n` : '';
        const body = typeof sec.body === 'string' ? `${sec.body}\n` : '';
        const items = Array.isArray(sec.items)
          ? (sec.items as string[]).map((item) => `- ${item}`).join('\n') + '\n'
          : '';
        return `${title}${body}${items}`;
      })
      .join('\n');
  }

  // Fallback: just stringify the JSON in a code block
  return '```json\n' + JSON.stringify(contentJson, null, 2) + '\n```';
}

type ContentReviewEditorProps = {
  contentId: string;
};

/**
 * A1.2 -- Side-by-side content review editor for admin/moderator.
 */
export function ContentReviewEditor({ contentId }: ContentReviewEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<ContentItem | null>(null);
  const [editorText, setEditorText] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [rejectModal, setRejectModal] = useState<RejectModalState>({ open: false, reason: '' });
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const renderedPreview = useMemo(() => renderWithLatex(editorText), [editorText]);

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/content/${contentId}`);
      const data = (await res.json()) as { content?: ContentItem; code?: string; message?: string };
      if (!res.ok) throw new Error(data.message ?? 'Failed to load');
      if (data.content) {
        setContent(data.content);
        setEditorText(renderContentPreview(data.content.contentJson));
      }
    } catch (err: unknown) {
      logger.error('ContentReviewEditor: fetchContent failed', { contentId, error: err });
      setErrorMsg('Could not load content. Tap to retry.');
    }
  }, [contentId]);

  useEffect(() => {
    void fetchContent();
  }, [fetchContent]);

  async function handleAction(action: 'approve' | 'reject' | 'save_draft', reason?: string) {
    setIsSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v1/admin/content/${contentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok) throw new Error(data.message ?? 'Action failed');
      setSuccessMsg(
        action === 'approve' ? 'Content approved!' :
        action === 'reject' ? 'Content rejected.' :
        'Draft saved.'
      );
      setTimeout(() => {
        setSuccessMsg('');
        if (action !== 'save_draft') router.push('/admin/moderation');
      }, 1500);
    } catch (err: unknown) {
      logger.error('ContentReviewEditor: handleAction failed', { contentId, action, error: err });
      setErrorMsg('Action failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveDraftWithContent() {
    setIsSaving(true);
    setErrorMsg('');
    try {
      // Convert edited markdown text back to contentJson
      const updatedJson = { rawMarkdown: editorText };
      const res = await fetch(`/api/v1/admin/content/${contentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentJson: updatedJson, action: 'save_draft' }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok) throw new Error(data.message ?? 'Save failed');
      setSuccessMsg('Draft saved.');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: unknown) {
      logger.error('ContentReviewEditor: handleSaveDraftWithContent failed', { contentId, error: err });
      setErrorMsg('Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!content) {
    return (
      <div className="flex h-64 items-center justify-center">
        {errorMsg ? (
          <div className="text-center">
            <p className="text-sm text-[#E24B4A]">{errorMsg}</p>
            <button
              type="button"
              onClick={() => void fetchContent()}
              className="mt-3 rounded-lg bg-[#534AB7] px-4 py-2 text-sm text-white"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#534AB7] border-t-transparent" />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/admin/moderation')}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ← Back
          </button>
          <h1 className="flex-1 truncate text-lg font-bold text-gray-900">{content.topic}</h1>
          <span className="rounded-full bg-[#EEEDFE] px-2 py-0.5 text-xs font-semibold text-[#534AB7]">
            v{content.version}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            content.status === 'APPROVED' ? 'bg-[#EAF3DE] text-[#1D9E75]' :
            content.status === 'REJECTED' ? 'bg-[#FCEBEB] text-[#E24B4A]' :
            content.status === 'PENDING_REVIEW' ? 'bg-[#FAEEDA] text-[#BA7517]' :
            'bg-gray-100 text-gray-600'
          }`}>
            {content.status.replace('_', ' ')}
          </span>
        </div>

        {/* Tabs */}
        <div className="mt-2 flex gap-4 border-b border-gray-100">
          {(['editor', 'history', 'flags'] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? 'border-b-2 border-[#534AB7] text-[#534AB7]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab}{tab === 'flags' && content.flags.length > 0 ? ` (${content.flags.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'editor' && (
          <>
            {/* Preview -- 70% */}
            <div className="w-7/10 flex-[7] overflow-y-auto border-r border-gray-200 bg-gray-50 p-6">
              <div className="prose prose-sm max-w-none">
                <h2 className="text-lg font-bold text-gray-900">{content.topic}</h2>
                <p className="text-xs text-gray-500">
                  {content.subject} · Grade {content.grade} · {content.board} · {content.language.toUpperCase()}
                </p>
                {/* eslint-disable-next-line react/no-danger */}
                <div
                  className="mt-4 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm text-gray-700 shadow-sm"
                  dangerouslySetInnerHTML={{ __html: renderedPreview }}
                />
              </div>
            </div>
            {/* Editor -- 30% */}
            <div className="flex-[3] overflow-y-auto p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Markdown Editor
              </p>
              <textarea
                ref={editorRef}
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                className="h-full min-h-[500px] w-full rounded-xl border border-gray-300 p-3 font-mono text-sm text-gray-800 focus:border-[#534AB7] focus:outline-none"
                placeholder="Edit markdown content here..."
                aria-label="Markdown editor"
              />
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-800">Version History</h2>
            {content.versions.length === 0 ? (
              <p className="text-sm text-gray-500">No previous versions recorded.</p>
            ) : (
              <div className="space-y-3">
                {content.versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="rounded-xl border border-gray-100 bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">
                        Version {ver.version}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(ver.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-[#534AB7]">
                        View snapshot
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                        {JSON.stringify(ver.contentJson, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'flags' && (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              Open Flags ({content.flags.length})
            </h2>
            {content.flags.length === 0 ? (
              <p className="text-sm text-gray-500">No open flags for this content.</p>
            ) : (
              <div className="space-y-3">
                {content.flags.map((flag) => (
                  <div
                    key={flag.id}
                    className="rounded-xl border border-[#FCEBEB] bg-[#FCEBEB]/30 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#E24B4A]">{flag.reason}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(flag.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {flag.notes && (
                      <p className="mt-1 text-sm text-gray-600">{flag.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3">
        {successMsg && (
          <div className="mb-2 rounded-xl bg-[#EAF3DE] px-3 py-2 text-sm font-medium text-[#1D9E75]">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-2 rounded-xl bg-[#FCEBEB] px-3 py-2 text-sm font-medium text-[#E24B4A]">
            {errorMsg}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleAction('approve')}
            title="Approve content (Shift+A)"
            className="min-h-[44px] flex-1 rounded-xl bg-[#1D9E75] px-4 text-sm font-semibold text-white disabled:opacity-60 hover:bg-[#18876b]"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => setRejectModal({ open: true, reason: '' })}
            title="Reject content (Shift+R)"
            className="min-h-[44px] flex-1 rounded-xl bg-[#E24B4A] px-4 text-sm font-semibold text-white disabled:opacity-60 hover:bg-[#c43a39]"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSaveDraftWithContent()}
            title="Save draft (Ctrl+S)"
            className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 disabled:opacity-60 hover:bg-gray-50"
          >
            Save Draft
          </button>
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="reject-modal-title" className="text-base font-bold text-gray-900">
              Reject Content
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Provide a reason for the rejection (required).
            </p>
            <textarea
              value={rejectModal.reason}
              onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g. Factual error in section 2..."
              className="mt-3 h-28 w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-[#534AB7] focus:outline-none"
              aria-label="Rejection reason"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={!rejectModal.reason.trim() || isSaving}
                onClick={() => {
                  void handleAction('reject', rejectModal.reason);
                  setRejectModal({ open: false, reason: '' });
                }}
                className="min-h-[44px] flex-1 rounded-xl bg-[#E24B4A] text-sm font-semibold text-white disabled:opacity-50"
              >
                Confirm Reject
              </button>
              <button
                type="button"
                onClick={() => setRejectModal({ open: false, reason: '' })}
                className="min-h-[44px] flex-1 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContentReviewEditor;
