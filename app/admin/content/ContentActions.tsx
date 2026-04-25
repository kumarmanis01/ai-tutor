'use client';

import { useState } from 'react';

export interface IngestRun {
  id: string;
  runAt: string;
  fileSource: string | null;
  board: string | null;
  chunksCreated: number;
  embeddingsGenerated: number;
  errors: number;
  durationMs: number | null;
}

interface CoverageRow {
  board: string;
  boardSlug: string;
  grade: number;
  subject: string;
  subjectId: string;
  language: string;
  questionCount: number;
  curriculumChunkCount: number;
  latestJob: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
  } | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status.toLowerCase()] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {status}
    </span>
  );
}

function QuestionCountCell({ count }: { count: number }) {
  const colour =
    count === 0
      ? 'text-red-600 dark:text-red-400'
      : count < 10
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-green-700 dark:text-green-400';
  return <span className={`font-semibold tabular-nums ${colour}`}>{count}</span>;
}

function RowActions({ row }: { row: CoverageRow }) {
  const [hydrateState, setHydrateState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [ingestState, setIngestState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [showNoChunksWarning, setShowNoChunksWarning] = useState(false);

  async function triggerHydrate() {
    if (row.curriculumChunkCount === 0 && !showNoChunksWarning) {
      setShowNoChunksWarning(true);
      return;
    }
    setShowNoChunksWarning(false);
    setHydrateState('loading');
    setMsg(null);
    try {
      const res = await fetch('/api/admin/content/hydrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: row.subjectId,
          board: row.boardSlug,
          grade: row.grade,
          language: row.language,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setHydrateState('error');
        setMsg('A job is already running for this subject.');
        return;
      }
      if (!res.ok) {
        setHydrateState('error');
        setMsg(data.message ?? data.error ?? 'Hydration failed.');
        return;
      }
      setHydrateState('done');
      setMsg(`Job created: ${data.jobId}`);
    } catch {
      setHydrateState('error');
      setMsg('Network error -- try again.');
    }
  }

  async function triggerIngest() {
    setIngestState('loading');
    setMsg(null);
    try {
      const res = await fetch('/api/admin/content/ingest-ncert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: row.subjectId,
          board: row.boardSlug,
          grade: row.grade,
          language: row.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIngestState('error');
        setMsg(data.message ?? data.error ?? 'Ingest failed.');
        return;
      }
      setIngestState('done');
      setMsg(data.message ?? 'Ingestion started.');
    } catch {
      setIngestState('error');
      setMsg('Network error -- try again.');
    }
  }

  const isJobActive = ['pending', 'running', 'processing'].includes(
    (row.latestJob?.status ?? '').toLowerCase()
  );

  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <div className="flex gap-2">
        <button
          onClick={triggerHydrate}
          disabled={hydrateState === 'loading' || isJobActive}
          className="min-h-[44px] min-w-[44px] px-3 py-1 rounded text-xs font-medium bg-[#534AB7] text-white hover:bg-[#3d3690] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {isJobActive
            ? 'In Progress...'
            : hydrateState === 'loading'
              ? 'Queuing...'
              : hydrateState === 'done'
                ? '✓ Queued'
                : 'Generate Questions'}
        </button>
        <button
          onClick={triggerIngest}
          disabled={ingestState === 'loading'}
          className="min-h-[44px] min-w-[44px] px-3 py-1 rounded text-xs font-medium bg-[#1D9E75] text-white hover:bg-[#157a5b] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {ingestState === 'loading'
            ? 'Starting...'
            : ingestState === 'done'
              ? '✓ Started'
              : 'Ingest NCERT'}
        </button>
      </div>
      {showNoChunksWarning && (
        <div className="mt-1 rounded border border-[#BA7517] bg-[#FAEEDA] dark:bg-amber-900/30 dark:border-amber-600 p-2">
          <p className="text-xs text-[#BA7517] dark:text-amber-300 font-medium">
            No NCERT content ingested yet. Hydrating without NCERT grounding may produce inaccurate
            chapters. Ingest NCERT first for best results.
          </p>
          <div className="mt-1.5 flex gap-2">
            <button
              onClick={triggerHydrate}
              className="min-h-[44px] min-w-[44px] px-3 py-1 rounded text-xs font-medium bg-[#534AB7] text-white hover:bg-[#3d3690] transition-colors"
            >
              Continue anyway
            </button>
            <button
              onClick={() => setShowNoChunksWarning(false)}
              className="min-h-[44px] min-w-[44px] px-3 py-1 rounded text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p
          className={`text-xs mt-0.5 ${hydrateState === 'error' || ingestState === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}

export function RecentIngestRuns({ runs }: { runs: IngestRun[] }) {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        No ingestion runs yet. Use the &quot;Ingest NCERT&quot; buttons above to start.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {[
              'Run at',
              'Source',
              'Board',
              'Chunks created',
              'Embeddings',
              'Errors',
              'Duration',
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300 tabular-nums">
                {new Date(run.runAt).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td
                className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[180px] truncate"
                title={run.fileSource ?? ''}
              >
                {run.fileSource ?? '--'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                {run.board ?? '--'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums font-medium text-gray-900 dark:text-gray-100">
                {run.chunksCreated}
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">
                {run.embeddingsGenerated}
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                {run.errors > 0 ? (
                  <span className="text-[#E24B4A] dark:text-red-400 font-semibold">
                    {run.errors}
                  </span>
                ) : (
                  <span className="text-[#1D9E75] dark:text-green-400">0</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums text-gray-500 dark:text-gray-400">
                {run.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)}s` : '--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ContentTable({ rows }: { rows: CoverageRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
        No subjects found. Seed ClassLevel + SubjectDef rows first.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {['Board', 'Grade', 'Subject', 'Questions', 'RAG Chunks', 'Latest Job', 'Actions'].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
          {rows.map((row) => (
            <tr
              key={row.subjectId}
              className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">
                {row.board}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                {row.grade}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-gray-100">
                {row.subject}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <QuestionCountCell count={row.questionCount} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {row.curriculumChunkCount === 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FCEBEB] text-[#E24B4A] dark:bg-red-900/40 dark:text-red-300">
                    Not ingested
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EAF3DE] text-[#1D9E75] dark:bg-green-900/40 dark:text-green-300">
                    {row.curriculumChunkCount} chunks
                  </span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {row.latestJob ? (
                  <div className="flex flex-col gap-0.5">
                    <StatusBadge status={row.latestJob.status} />
                    {row.latestJob.completedAt && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(row.latestJob.completedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    )}
                    {row.latestJob.error && (
                      <span
                        className="text-xs text-red-500 dark:text-red-400 truncate max-w-[160px]"
                        title={row.latestJob.error}
                      >
                        {row.latestJob.error}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500">--</span>
                )}
              </td>
              <td className="px-4 py-3">
                <RowActions row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
