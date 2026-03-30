"use client";

import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const fetcher = (url: string) => fetch(url).then(r => r.json());

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
  const pct = expected > 0 ? Math.min(100, Math.round((completed / expected) * 100)) : 0;
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
          <span className="text-xs text-gray-500 w-20 text-right">
            {completed}/{expected > 0 ? expected : '?'} tracked
          </span>
        </div>
      </div>
      <div className="text-xs text-[#1D9E75] font-medium w-24 text-right">
        {actual} in DB
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const { data, error, mutate } = useSWR(id ? `/api/admin/jobs/${id}` : null, fetcher);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  async function doAction(action: 'pause' | 'resume' | 'cancel') {
    setActionBusy(true);
    setActionErr(null);
    try {
      const r = await fetch(`/api/admin/jobs/${id}/${action}`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Failed');
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
  const isPaused = job.status === 'paused';
  const isFailed = job.status === 'failed';
  const isStuck = isRunning && job.lockedAt &&
    (Date.now() - new Date(job.lockedAt).getTime()) > 2 * 60 * 60 * 1000; // 2h

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
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
        <StatusBadge status={job.status} />
      </div>

      {isStuck && (
        <div className="bg-[#FAEEDA] border border-[#EF9F27] rounded-lg px-4 py-3 text-sm text-[#633806]">
          <span className="font-semibold">Job appears stuck</span> -- locked over 2 hours ago with no progress.
          Use Pause + Resume or Cancel to recover.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {actionErr && <span className="text-xs text-[#E24B4A]">{actionErr}</span>}
        {isRunning && (
          <>
            <ActionBtn onClick={() => doAction('pause')} disabled={actionBusy} v="warn">Pause</ActionBtn>
            <ActionBtn onClick={() => doAction('cancel')} disabled={actionBusy} v="danger">Cancel</ActionBtn>
          </>
        )}
        {isPaused && (
          <>
            <ActionBtn onClick={() => doAction('resume')} disabled={actionBusy} v="primary">Resume</ActionBtn>
            <ActionBtn onClick={() => doAction('cancel')} disabled={actionBusy} v="danger">Cancel</ActionBtn>
          </>
        )}
        {isFailed && (
          <ActionBtn onClick={() => doAction('resume')} disabled={actionBusy} v="primary">Retry</ActionBtn>
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
            <p>{new Date(job.lockedAt).toLocaleString()}</p>
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
          <p className="text-sm text-[#791F1F] whitespace-pre-wrap">{job.lastError}</p>
        </div>
      )}

      {/* Progress -- tracked vs actual */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-medium text-gray-700 mb-3">
          Progress
          <span className="ml-2 text-xs font-normal text-gray-400">(tracked = job fields, in DB = actual records)</span>
        </p>
        <ProgressRow
          label="Chapters"
          completed={job.chaptersCompleted}
          expected={job.chaptersExpected}
          actual={job.actualChapters}
        />
        <ProgressRow
          label="Topics"
          completed={job.topicsCompleted}
          expected={job.topicsExpected}
          actual={job.actualTopics}
        />
        <ProgressRow
          label="Notes"
          completed={job.notesCompleted}
          expected={job.notesExpected}
          actual={job.actualNotes}
        />
        <ProgressRow
          label="Questions"
          completed={job.questionsCompleted}
          expected={job.questionsExpected}
          actual={job.actualQuestions}
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
