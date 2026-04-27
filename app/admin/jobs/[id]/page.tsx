"use client";

import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// How old a lockedAt must be before "Unstick" is offered (10 min in ms)
const STUCK_THRESHOLD_MS = 10 * 60 * 1000;

const STATUS_CFG: Record<string, { bg: string; text: string }> = {
  running:   { bg: 'bg-[#E6F1FB]', text: 'text-[#0C447C]' },
  pending:   { bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  completed: { bg: 'bg-[#EAF3DE]', text: 'text-[#27500A]' },
  failed:    { bg: 'bg-[#FCEBEB]', text: 'text-[#791F1F]' },
  paused:    { bg: 'bg-gray-100',  text: 'text-gray-600' },
  cancelled: { bg: 'bg-gray-100',  text: 'text-gray-500' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { bg: 'bg-gray-100', text: 'text-gray-500' };
  return (
    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {String(status).toUpperCase()}
    </span>
  );
}

function ProgressRow({
  label,
  completed,
  expected,
  actual,
}: {
  label: string;
  completed: number;
  expected: number;
  actual: number;
}) {
  // When tracked expected is 0 but actual exists, use actual as the denominator
  // so the bar reflects real progress even before the reconciler has run.
  const effectiveExpected = expected > 0 ? expected : actual;
  const pct = effectiveExpected > 0 ? Math.min(100, Math.round((completed / effectiveExpected) * 100)) : 0;
  const trackedLabel = expected > 0 ? `${completed}/${expected}` : actual > 0 ? 'not yet tracked' : '0/0';
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="w-24 text-sm text-gray-600">{label}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#534AB7] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-xs w-28 text-right ${expected === 0 && actual > 0 ? 'text-[#BA7517]' : 'text-gray-500'}`}>
            {trackedLabel}
          </span>
        </div>
      </div>
      <div className={`text-xs font-medium w-24 text-right ${actual > 0 ? 'text-[#1D9E75]' : 'text-gray-400'}`}>
        {actual} in DB
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  // Auto-poll every 5s while the job is active (running/pending/paused)
  const { data, error, mutate, isValidating } = useSWR(
    id ? `/api/admin/jobs/${id}` : null,
    fetcher,
    {
      refreshInterval: (data) => {
        const status = data?.job?.status;
        return (status === 'running' || status === 'pending') ? 5000 : 0;
      },
    }
  );

  const [actionBusy, setActionBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function doAction(action: 'pause' | 'resume' | 'cancel' | 'unstick' | 'requeue') {
    setActionBusy(true);
    setActionErr(null);
    setActionMsg(null);
    try {
      const r = await fetch(`/api/admin/jobs/${id}/${action}`, { method: 'POST' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? 'Failed');
      if (body.message) setActionMsg(body.message);
      mutate();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionBusy(false);
    }
  }

  if (error) return <div className="p-6 text-red-600">Failed to load job.</div>;
  if (!data) return <div className="p-6 text-gray-500">Loading...</div>;
  if (!data.job) return (
    <div className="p-6 text-red-600">
      Job not found.{' '}
      <Link href="/admin/jobs" className="underline text-blue-600">Back to jobs</Link>
    </div>
  );

  const { job } = data;
  const isRunning = job.status === 'running';
  const isPending = job.status === 'pending';
  const isPaused = job.status === 'paused';
  const isFailed = job.status === 'failed';

  const lockedAgeMs = job.lockedAt ? Date.now() - new Date(job.lockedAt).getTime() : 0;
  const isStuck = isRunning && lockedAgeMs > STUCK_THRESHOLD_MS;

  const trackedFieldsEmpty =
    job.chaptersExpected === 0 && job.topicsExpected === 0 &&
    job.notesExpected === 0 && job.questionsExpected === 0;
  const hasActualContent = (job.actualChapters ?? 0) > 0 || (job.actualTopics ?? 0) > 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/jobs" className="text-xs text-[#534AB7] hover:underline">
            &larr; All jobs
          </Link>
          <h1 className="text-xl font-semibold mt-1">
            {job.subject ?? 'Unknown'} &mdash; Grade {job.grade} ({String(job.board ?? '').toUpperCase()})
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{job.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors min-h-[28px]"
            title="Refresh data"
          >
            {isValidating ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stuck warning */}
      {isStuck && (
        <div className="bg-[#FAEEDA] border border-[#EF9F27] rounded-lg px-4 py-3 text-sm text-[#633806]">
          <span className="font-semibold">Job appears stuck</span> -- locked{' '}
          {Math.round(lockedAgeMs / 60000)} minutes ago with no progress update.
          If the task worker is not running, use <strong>Unstick</strong> to reset it to
          pending so it can be reclaimed when the worker restarts.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {actionErr && <span className="text-xs text-[#E24B4A] w-full">{actionErr}</span>}
        {actionMsg && <span className="text-xs text-[#1D9E75] w-full">{actionMsg}</span>}
        {isRunning && !isStuck && (
          <>
            <ActionBtn onClick={() => doAction('pause')} disabled={actionBusy} v="warn">Pause</ActionBtn>
            <ActionBtn onClick={() => doAction('cancel')} disabled={actionBusy} v="danger">Cancel</ActionBtn>
          </>
        )}
        {isStuck && (
          <>
            <ActionBtn onClick={() => doAction('unstick')} disabled={actionBusy} v="primary">Unstick (reset to pending)</ActionBtn>
            <ActionBtn onClick={() => doAction('cancel')} disabled={actionBusy} v="danger">Cancel</ActionBtn>
          </>
        )}
        {isPaused && (
          <>
            <ActionBtn onClick={() => doAction('resume')} disabled={actionBusy} v="primary">Resume</ActionBtn>
            <ActionBtn onClick={() => doAction('cancel')} disabled={actionBusy} v="danger">Cancel</ActionBtn>
          </>
        )}
        {isPending && (
          <>
            <ActionBtn onClick={() => doAction('requeue')} disabled={actionBusy} v="primary">Requeue</ActionBtn>
            <ActionBtn onClick={() => doAction('cancel')} disabled={actionBusy} v="danger">Cancel</ActionBtn>
          </>
        )}
        {isFailed && (
          <ActionBtn onClick={() => doAction('requeue')} disabled={actionBusy} v="primary">Retry</ActionBtn>
        )}
      </div>

      {/* Timestamps */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-500">Created</p>
          <p>{new Date(job.createdAt).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Last updated</p>
          <p>{new Date(job.updatedAt).toLocaleString()}</p>
        </div>
        {job.lockedAt && (
          <div>
            <p className="text-xs text-gray-500">Locked at</p>
            <p className={isStuck ? 'text-[#BA7517] font-medium' : ''}>
              {new Date(job.lockedAt).toLocaleString()}
            </p>
          </div>
        )}
        {job.completedAt && (
          <div>
            <p className="text-xs text-gray-500">Completed</p>
            <p>{new Date(job.completedAt).toLocaleString()}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500">Attempts</p>
          <p>{job.attempts}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Job type</p>
          <p className="capitalize">{job.jobType}</p>
        </div>
      </div>

      {/* Error */}
      {job.lastError && (
        <div className="bg-[#FCEBEB] border border-[#f9d7d7] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#791F1F] mb-1">Last error</p>
          <p className="text-sm text-[#791F1F] whitespace-pre-wrap break-all">{job.lastError}</p>
        </div>
      )}

      {/* Progress tracked vs actual */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-700">
            Progress
            <span className="ml-2 text-xs font-normal text-gray-400">(tracked = job fields, in DB = actual records)</span>
          </p>
        </div>

        {/* Banner when reconciler has not yet run but content exists */}
        {trackedFieldsEmpty && hasActualContent && (
          <div className="mb-3 flex items-start gap-2 bg-[#FAEEDA] border border-[#f5d193] rounded-lg px-3 py-2 text-[11px] text-[#633806]">
            <span className="shrink-0 mt-0.5">&#9432;</span>
            <span>
              Tracked counters are 0 because the reconciler has not yet run.
              They update automatically when the task worker is active.
              The <strong>in DB</strong> column shows actual content that was already created.
            </span>
          </div>
        )}

        <ProgressRow
          label="Chapters"
          completed={job.chaptersCompleted}
          expected={job.chaptersExpected}
          actual={job.actualChapters ?? 0}
        />
        <ProgressRow
          label="Topics"
          completed={job.topicsCompleted}
          expected={job.topicsExpected}
          actual={job.actualTopics ?? 0}
        />
        <ProgressRow
          label="Notes"
          completed={job.notesCompleted}
          expected={job.notesExpected}
          actual={job.actualNotes ?? 0}
        />
        <ProgressRow
          label="Questions"
          completed={job.questionsCompleted}
          expected={job.questionsExpected}
          actual={job.actualQuestions ?? 0}
        />
      </div>

      {/* Child jobs summary */}
      {Object.keys(job.childCounts ?? {}).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Child jobs</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(job.childCounts as Record<string, number>).map(([status, count]) => {
              const cfg = STATUS_CFG[status] ?? { bg: 'bg-gray-100', text: 'text-gray-500' };
              return (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}
                >
                  {status} <span className="font-semibold">{count}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  v,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  v: 'primary' | 'danger' | 'warn';
}) {
  const cls = {
    primary: 'border-[#534AB7] bg-[#EEEDFE] text-[#3C3489] hover:bg-[#e0defe]',
    danger:  'border-[#f9d7d7] bg-[#FCEBEB] text-[#791F1F] hover:bg-[#f9d7d7]',
    warn:    'border-[#f5d193] bg-[#FAEEDA] text-[#633806] hover:bg-[#f5d193]',
  }[v];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center text-sm px-3 py-1.5 rounded border min-h-[36px] transition-colors disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}
