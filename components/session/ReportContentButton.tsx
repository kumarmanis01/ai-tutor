'use client';

import React, { useState } from 'react';

type ReportContentButtonProps = {
  topicId: string;
};

const ISSUE_OPTIONS = [
  { value: 'incorrect_info', label: 'Incorrect information' },
  { value: 'typo', label: 'Typo or spelling error' },
  { value: 'unclear_explanation', label: 'Unclear explanation' },
  { value: 'missing_content', label: 'Missing content' },
  { value: 'other', label: 'Other' },
] as const;

export function ReportContentButton({ topicId }: ReportContentButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setShowModal(false);
    setIssueType('');
    setDescription('');
    setDone(false);
    setError(null);
  }

  async function submit() {
    if (submitting || !issueType || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/content/${encodeURIComponent(topicId)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueType, description: description.trim() }),
      });
      if (!res.ok) throw new Error('Submission failed');
      setDone(true);
    } catch {
      setError("Couldn't submit right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="min-h-[44px] rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
      >
        Report Content Issue
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Report a Content Issue
            </h2>
            {done ? (
              <>
                <p className="mt-3 text-sm text-[#1D9E75]">
                  Thanks for letting us know. We will review and fix it soon.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 min-h-[44px] w-full rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Help us improve this topic for everyone.
                </p>
                <div className="mt-4 space-y-2">
                  {ISSUE_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 dark:border-slate-700"
                    >
                      <input
                        type="radio"
                        name="issueType"
                        value={value}
                        checked={issueType === value}
                        onChange={() => setIssueType(value)}
                        className="accent-[#534AB7]"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  className="mt-3 min-h-[80px] w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300"
                  placeholder="Describe the issue (required)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                />
                {error && <p className="mt-2 text-xs text-[#E24B4A]">{error}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="min-h-[44px] flex-1 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-600 dark:border-slate-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { void submit(); }}
                    disabled={submitting || !issueType || !description.trim()}
                    className="min-h-[44px] flex-1 rounded-xl bg-[#534AB7] px-4 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
